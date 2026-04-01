import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { CmmfSource } from "../types.js";
import { pathExists } from "../utils/fs.js";

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const defaultSiblingRepo = path.resolve(packageRoot, "../content-model-master-format");
const expectedRemote = "https://github.com/headless-company/content-model-master-format";

export async function resolveCmmfSource(explicitPath?: string): Promise<CmmfSource> {
  const candidates = [explicitPath, process.env.CMMF_SPEC_REPO_PATH, defaultSiblingRepo].filter(
    (value): value is string => Boolean(value && value.trim().length > 0),
  );

  for (const candidate of candidates) {
    const source = await tryLoadCmmfSource(path.resolve(candidate));
    if (source) {
      return source;
    }
  }

  throw new Error(
    [
      "Unable to find a usable CMMF spec repository.",
      `Checked: ${candidates.map((value) => path.resolve(value)).join(", ") || "(no candidates)"}`,
      "Pass --cmmf-repo /path/to/content-model-master-format or set CMMF_SPEC_REPO_PATH.",
      `Expected repository: ${expectedRemote}`,
    ].join("\n"),
  );
}

export function formatCmmfSource(source: CmmfSource): string {
  const bits = [source.rootDir];
  if (source.branch || source.revision) {
    bits.push([source.branch, source.revision].filter(Boolean).join("@"));
  }
  if (source.remoteUrl) {
    bits.push(source.remoteUrl);
  }
  return bits.join(" | ");
}

async function tryLoadCmmfSource(rootDir: string): Promise<CmmfSource | null> {
  const schemaPath = path.join(rootDir, "schemas/model.schema.json");
  const specPath = path.join(rootDir, "spec/cmmf-v1.md");
  const relationshipsDocPath = path.join(rootDir, "docs/relationships.md");
  const requiredFiles = [schemaPath, specPath, relationshipsDocPath];
  const exists = await Promise.all(requiredFiles.map((filePath) => pathExists(filePath)));

  if (!exists.every(Boolean)) {
    return null;
  }

  const { revision, branch, remoteUrl } = await getGitMetadata(rootDir);
  return {
    rootDir,
    schemaPath,
    specPath,
    relationshipsDocPath,
    revision,
    branch,
    remoteUrl,
  };
}

async function getGitMetadata(rootDir: string): Promise<Pick<CmmfSource, "revision" | "branch" | "remoteUrl">> {
  try {
    const [{ stdout: revision }, { stdout: branch }, { stdout: remoteUrl }] = await Promise.all([
      execFileAsync("git", ["-C", rootDir, "rev-parse", "--short", "HEAD"]),
      execFileAsync("git", ["-C", rootDir, "branch", "--show-current"]),
      execFileAsync("git", ["-C", rootDir, "remote", "get-url", "origin"]),
    ]);

    return {
      revision: revision.trim() || null,
      branch: branch.trim() || null,
      remoteUrl: remoteUrl.trim() || null,
    };
  } catch {
    return {
      revision: null,
      branch: null,
      remoteUrl: null,
    };
  }
}
