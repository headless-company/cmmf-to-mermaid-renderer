import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { ExportOptions, ExportResult } from "../types.js";
import { writeText } from "../utils/fs.js";

const execFileAsync = promisify(execFile);

export async function exportMermaidImage(options: ExportOptions): Promise<ExportResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cmmf-mermaid-"));
  const inputPath = path.join(tempDir, "diagram.mmd");

  try {
    await writeText(inputPath, options.mermaid);
    try {
      await execFileAsync(
        "mmdc",
        ["-i", inputPath, "-o", options.outputPath, "-e", options.format],
        { cwd: options.cwd },
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        [
          `Unable to export ${options.format.toUpperCase()} because Mermaid CLI (mmdc) is not available or failed to run.`,
          "Install Mermaid CLI or make `mmdc` available on PATH, then try again.",
          `Underlying error: ${reason}`,
        ].join("\n"),
      );
    }

    return {
      outputPath: options.outputPath,
      format: options.format,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
