#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { buildVisualGraph } from "./graph/build.js";
import { selectDiagramGraph } from "./graph/select.js";
import { exportMermaidImage } from "./render/export.js";
import { renderMermaid } from "./render/mermaid.js";
import { loadCmmfRepo } from "./cmmf/repo.js";
import { formatCmmfSource } from "./cmmf/source.js";
import type { DiagramDirection, DiagramView, ImageFormat } from "./types.js";
import { diagramDirections, diagramViews, imageFormats } from "./types.js";
import { writeText } from "./utils/fs.js";

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }

  return {
    command: positionals.shift(),
    positionals,
    flags,
  };
}

function getFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === "string" ? value : undefined;
}

function parseView(value: string | undefined): DiagramView {
  if (!value || !diagramViews.includes(value as DiagramView)) {
    throw new Error(`--view must be one of: ${diagramViews.join(", ")}`);
  }
  return value as DiagramView;
}

function parseDirection(value: string | undefined): DiagramDirection {
  if (!value) {
    return "LR";
  }
  if (!diagramDirections.includes(value as DiagramDirection)) {
    throw new Error(`--direction must be one of: ${diagramDirections.join(", ")}`);
  }
  return value as DiagramDirection;
}

function parseImageFormat(value: string | undefined): ImageFormat | undefined {
  if (!value) {
    return undefined;
  }
  if (!imageFormats.includes(value as ImageFormat)) {
    throw new Error(`--image must be one of: ${imageFormats.join(", ")}`);
  }
  return value as ImageFormat;
}

function parseDepth(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("--depth must be a non-negative integer.");
  }
  return parsed;
}

async function handleRender(args: ParsedArgs): Promise<void> {
  const repoPath = path.resolve(getFlag(args, "repo") ?? process.cwd());
  const view = parseView(getFlag(args, "view"));
  const direction = parseDirection(getFlag(args, "direction"));
  const depth = parseDepth(getFlag(args, "depth"));
  const outputPath = getFlag(args, "output");
  const imageFormat = parseImageFormat(getFlag(args, "image"));
  const modelId = getFlag(args, "model");

  const repo = await loadCmmfRepo({
    repoPath,
    cmmfRepoPath: getFlag(args, "cmmf-repo"),
  });
  const graph = buildVisualGraph(repo);
  const diagram = selectDiagramGraph(graph, { view, modelId, depth, direction });
  const mermaid = renderMermaid(diagram, { direction });

  if (outputPath) {
    await writeText(path.resolve(outputPath), mermaid);
  } else {
    process.stdout.write(`${mermaid}\n`);
  }

  if (diagram.warnings.length > 0) {
    for (const warning of diagram.warnings) {
      process.stderr.write(`Warning: ${warning.message}\n`);
    }
  }

  if (imageFormat) {
    const resolvedOutput = outputPath ? path.resolve(outputPath) : path.resolve(process.cwd(), `diagram.${imageFormat}`);
    const imageOutputPath = resolvedOutput.endsWith(`.${imageFormat}`)
      ? resolvedOutput
      : resolvedOutput.replace(/\.[^.]+$/, "") + `.${imageFormat}`;

    const result = await exportMermaidImage({
      mermaid,
      format: imageFormat,
      outputPath: imageOutputPath,
      cwd: process.cwd(),
    });
    process.stderr.write(`Exported ${result.format.toUpperCase()} to ${result.outputPath}\n`);
  }

  process.stderr.write(`CMMF source: ${formatCmmfSource(repo.source)}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "render":
      await handleRender(args);
      break;
    case "help":
    case undefined:
      process.stdout.write(
        [
          "Usage:",
          "  cmmf-mermaid render --repo /path/to/repo --view model|organism|landscape [--model id] [--depth n] [--direction LR|TB] [--output path] [--image svg|png] [--cmmf-repo path]",
        ].join("\n") + "\n",
      );
      break;
    default:
      throw new Error(`Unknown command: ${args.command}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
