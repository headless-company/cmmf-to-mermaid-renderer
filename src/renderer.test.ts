import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildVisualGraph } from "./graph/build.js";
import { selectDiagramGraph } from "./graph/select.js";
import { exportMermaidImage } from "./render/export.js";
import { renderMermaid } from "./render/mermaid.js";
import { loadCmmfRepo } from "./cmmf/repo.js";
import { writeText } from "./utils/fs.js";

const execFileAsync = promisify(execFile);
const examplesRepo = "/Users/djeglin/Projects/HeadlessCo/content-model-master-format/examples";
const cmmfRepo = "/Users/djeglin/Projects/HeadlessCo/content-model-master-format";
const packageRoot = "/Users/djeglin/Projects/HeadlessCo/cmmf-to-mermaid-renderer";

test("loads the example CMMF repo and renders the landscape view", async () => {
  const repo = await loadCmmfRepo({ repoPath: examplesRepo, cmmfRepoPath: cmmfRepo });
  const graph = buildVisualGraph(repo);
  const diagram = selectDiagramGraph(graph, { view: "landscape" });
  const mermaid = renderMermaid(diagram);

  assert.equal(repo.modelFiles.length, 4);
  assert.match(mermaid, /^erDiagram/m);
  assert.match(mermaid, /PAGE \|\|--o\{ ARTICLE : ""/);
  assert.match(mermaid, /ARTICLE \|\|--o\| PERSON : ""/);
  assert.match(mermaid, /ARTICLE \|\|--o\| SEO_METADATA : ""/);
  assert.match(mermaid, /ARTICLE \{/);
  assert.match(mermaid, /Title string/);
});

test("renders a detailed model diagram for article", async () => {
  const repo = await loadCmmfRepo({ repoPath: examplesRepo, cmmfRepoPath: cmmfRepo });
  const graph = buildVisualGraph(repo);
  const diagram = selectDiagramGraph(graph, { view: "model", modelId: "article" });
  const mermaid = renderMermaid(diagram);

  assert.match(mermaid, /^erDiagram/m);
  assert.match(mermaid, /ARTICLE \{/);
  assert.match(mermaid, /Title string/);
  assert.match(mermaid, /Slug slug/);
  assert.match(mermaid, /Body richText/);
  assert.match(mermaid, /Author reference/);
  assert.match(mermaid, /ARTICLE \|\|--o\| PERSON : ""/);
  assert.match(mermaid, /ARTICLE \|\|--o\| SEO_METADATA : ""/);
});

test("renders organism view with configurable depth and no duplicate expansion", async () => {
  const repo = await loadCmmfRepo({ repoPath: examplesRepo, cmmfRepoPath: cmmfRepo });
  const graph = buildVisualGraph(repo);
  const depthOne = selectDiagramGraph(graph, { view: "organism", modelId: "page", depth: 1 });
  const depthTwo = selectDiagramGraph(graph, { view: "organism", modelId: "page", depth: 2 });

  assert.deepEqual(
    depthOne.nodes.map((node) => node.modelId).sort(),
    ["article", "page", "seo-metadata"],
  );
  assert.deepEqual(
    depthTwo.nodes.map((node) => node.modelId).sort(),
    ["article", "page", "person", "seo-metadata"],
  );
  assert.equal(new Set(depthTwo.nodes.map((node) => node.id)).size, depthTwo.nodes.length);
});

test("infers plural semantics from list fields used in sandbox models", async () => {
  const repo = await loadCmmfRepo({ repoPath: "/tmp/cmmf-agent-sandbox", cmmfRepoPath: cmmfRepo });
  const graph = buildVisualGraph(repo);
  const diagram = selectDiagramGraph(graph, { view: "landscape" });
  const mermaid = renderMermaid(diagram);

  assert.match(mermaid, /BLOG_POST \|\|--o\{ CATEGORY : ""/);
  assert.match(mermaid, /LANDING_PAGE \|\|--o\{ BLOG_POST : ""/);
  assert.match(mermaid, /LANDING_PAGE \|\|--o\{ CONTENT_SECTION : ""/);
});

test("creates placeholder nodes and warnings for missing target models", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cmmf-mermaid-missing-"));
  try {
    await writeText(
      path.join(tempRoot, "manifest.yaml"),
      ["specVersion: 1", "namespace: test.missing", "modelsPath: ./models"].join("\n"),
    );
    await writeText(
      path.join(tempRoot, "models", "page.yaml"),
      [
        "id: page",
        "name: Page",
        "kind: entry",
        "fields:",
        "  - id: seo",
        "    type: object",
        "    objectType: seo-metadata",
      ].join("\n"),
    );

    const repo = await loadCmmfRepo({ repoPath: tempRoot, cmmfRepoPath: cmmfRepo });
    const graph = buildVisualGraph(repo);
    const diagram = selectDiagramGraph(graph, { view: "landscape" });

    assert.equal(diagram.warnings.length, 1);
    assert.equal(diagram.warnings[0]?.code, "missing-target-model");
    assert.ok(diagram.nodes.some((node) => node.kind === "missing"));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("handles cyclic references without infinite traversal", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cmmf-mermaid-cycle-"));
  try {
    await writeText(
      path.join(tempRoot, "manifest.yaml"),
      ["specVersion: 1", "namespace: test.cycle", "modelsPath: ./models"].join("\n"),
    );
    await writeText(
      path.join(tempRoot, "models", "a.yaml"),
      [
        "id: a",
        "name: A",
        "kind: entry",
        "fields:",
        "  - id: b_ref",
        "    type: reference",
        "    targets: [b]",
        "    relation:",
        "      cardinality: one",
      ].join("\n"),
    );
    await writeText(
      path.join(tempRoot, "models", "b.yaml"),
      [
        "id: b",
        "name: B",
        "kind: entry",
        "fields:",
        "  - id: a_ref",
        "    type: reference",
        "    targets: [a]",
        "    relation:",
        "      cardinality: one",
      ].join("\n"),
    );

    const repo = await loadCmmfRepo({ repoPath: tempRoot, cmmfRepoPath: cmmfRepo });
    const graph = buildVisualGraph(repo);
    const diagram = selectDiagramGraph(graph, { view: "organism", modelId: "a", depth: 4 });

    assert.deepEqual(
      diagram.nodes.map((node) => node.modelId).sort(),
      ["a", "b"],
    );
    assert.equal(diagram.edges.length, 2);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("cli render prints mermaid to stdout", async () => {
  const { stdout, stderr } = await execFileAsync(
    "node",
    [
      "--import",
      "tsx",
      "./src/cli.ts",
      "render",
      "--repo",
      examplesRepo,
      "--cmmf-repo",
      cmmfRepo,
      "--view",
      "landscape",
    ],
    { cwd: packageRoot },
  );

  assert.match(stdout, /erDiagram/);
  assert.match(stdout, /: ""/);
  assert.match(stderr, /CMMF source:/);
});

test("exports svg via mmdc when available on PATH", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "cmmf-mermaid-export-"));
  try {
    const binDir = path.join(tempRoot, "bin");
    await mkdir(binDir, { recursive: true });
    const fakeMmdc = path.join(binDir, "mmdc");
    await writeText(
      fakeMmdc,
      [
        "#!/usr/bin/env node",
        "const { writeFileSync } = require('node:fs');",
        "const args = process.argv.slice(2);",
        "const output = args[args.indexOf('-o') + 1];",
        "writeFileSync(output, '<svg>ok</svg>', 'utf8');",
      ].join("\n"),
    );
    await chmod(fakeMmdc, 0o755);

    const outputPath = path.join(tempRoot, "diagram.svg");
    const originalPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ""}`;
    try {
      const result = await exportMermaidImage({
        mermaid: "flowchart LR\n    a-->b\n",
        outputPath,
        format: "svg",
        cwd: tempRoot,
      });

      assert.equal(result.outputPath, outputPath);
    } finally {
      process.env.PATH = originalPath;
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
