# CMMF to Mermaid Renderer

CLI and library for generating Mermaid diagrams from [Content Model Master Format (CMMF)](/Users/djeglin/Projects/HeadlessCo/content-model-master-format/README.md) repositories.

This project reads a CMMF repo, validates it against the neighbouring CMMF spec repository, builds an internal model graph, and renders Mermaid output that is useful for documentation, review, and architecture conversations.

## What It Does

- Loads `manifest.yaml` and model files from a CMMF repository
- Validates models against the CMMF JSON Schema and local type rules
- Normalizes manifest defaults such as `required` and `localisation`
- Builds a visual graph of models, fields, references, and embedded objects
- Renders Mermaid `erDiagram` output for:
  - a single model
  - a rooted organism/system view
  - a full repo landscape
- Optionally exports SVG or PNG by shelling out to Mermaid CLI (`mmdc`)

## Current Output Shape

The renderer currently uses Mermaid `erDiagram` output for all views.

That means:

- each content type or object model is rendered as a single entity
- fields are shown as rows inside the entity
- optional fields are marked with `"*"` in the attribute comment
- relationship lines use Mermaid ER cardinality markers
- relationship labels are intentionally emitted as empty strings (`: ""`) to avoid clutter while keeping Mermaid syntax valid

## Requirements

- Node.js 22+
- npm 11.10+ or newer
- a local checkout of `content-model-master-format`

Optional for image export:

- Mermaid CLI available on `PATH` as `mmdc`

## Install

```bash
npm install
```

## Quick Start

Render the full model landscape for a CMMF repo:

```bash
npm run render -- --repo /path/to/cmmf-repo --cmmf-repo ../content-model-master-format --view landscape
```

Render a single model:

```bash
npm run render -- --repo /path/to/cmmf-repo --cmmf-repo ../content-model-master-format --view model --model landing_page
```

Render an organism view rooted at one model:

```bash
npm run render -- --repo /path/to/cmmf-repo --cmmf-repo ../content-model-master-format --view organism --model landing_page --depth 2
```

Write Mermaid output to a file:

```bash
npm run render -- --repo /path/to/cmmf-repo --cmmf-repo ../content-model-master-format --view landscape --output ./diagram.mmd
```

Export an SVG:

```bash
npm run render -- --repo /path/to/cmmf-repo --cmmf-repo ../content-model-master-format --view model --model blog_post --output ./blog-post.mmd --image svg
```

## CLI

The CLI entrypoint is `cmmf-mermaid`.

Usage:

```bash
cmmf-mermaid render \
  --repo /path/to/cmmf-repo \
  --view model|organism|landscape \
  [--model model-id] \
  [--depth 2] \
  [--direction LR|TB] \
  [--output ./diagram.mmd] \
  [--image svg|png] \
  [--cmmf-repo /path/to/content-model-master-format]
```

Notes:

- `--model` is required for `model` and `organism`
- `--depth` applies only to `organism`
- `--direction` is passed through to Mermaid ER output; Mermaid may not respect it as strongly as flowcharts do
- if `--output` is omitted, Mermaid is printed to stdout
- if `--image` is provided, the tool renders Mermaid first and then calls `mmdc`

## Views

### `model`

Shows one model as a single Mermaid entity with its fields listed as attributes, plus relationships to referenced or embedded target models.

Best for:

- onboarding to one content type
- implementation planning
- reviewing field structure and model dependencies together

### `organism`

Shows a rooted subgraph around one chosen model using graph traversal.

Best for:

- showing the connected system around a page, post, or reusable block
- explaining how a bundle of related models fits together

### `landscape`

Shows every model in the repo and the relationships between them.

Best for:

- architecture review
- spotting over-connected models
- generating repo-level documentation

## Library Usage

The package can also be imported as a library.

```ts
import {
  buildVisualGraph,
  loadCmmfRepo,
  renderMermaid,
  selectDiagramGraph,
} from "cmmf-to-mermaid-renderer";

const repo = await loadCmmfRepo({
  repoPath: "/path/to/cmmf-repo",
  cmmfRepoPath: "/path/to/content-model-master-format",
});

const graph = buildVisualGraph(repo);
const diagram = selectDiagramGraph(graph, {
  view: "model",
  modelId: "landing_page",
  direction: "LR",
});
const mermaid = renderMermaid(diagram);
```

Public exports:

- `loadCmmfRepo`
- `buildVisualGraph`
- `selectDiagramGraph`
- `renderMermaid`
- `exportMermaidImage`
- `resolveCmmfSource`
- `formatCmmfSource`
- `createCmmfValidators`

## How CMMF Semantics Map To Mermaid

- `reference` fields become ER relationships between entities
- `object` fields also become ER relationships, representing embedded structures
- `relation.cardinality: many` becomes a plural relationship marker
- `list: true` is also treated as plural when older or looser model data omits explicit relation cardinality
- missing target models are rendered as placeholder entities and surfaced as warnings

## CMMF Spec Resolution

The renderer resolves the CMMF spec repo in this order:

1. `--cmmf-repo`
2. `CMMF_SPEC_REPO_PATH`
3. sibling checkout at `../content-model-master-format`

## Development

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run the full local check:

```bash
npm run check
```

## Project Structure

- [`src/cli.ts`](/Users/djeglin/Projects/HeadlessCo/cmmf-to-mermaid-renderer/src/cli.ts): CLI entrypoint
- [`src/cmmf/repo.ts`](/Users/djeglin/Projects/HeadlessCo/cmmf-to-mermaid-renderer/src/cmmf/repo.ts): repo loading and normalization
- [`src/graph/build.ts`](/Users/djeglin/Projects/HeadlessCo/cmmf-to-mermaid-renderer/src/graph/build.ts): graph construction
- [`src/graph/select.ts`](/Users/djeglin/Projects/HeadlessCo/cmmf-to-mermaid-renderer/src/graph/select.ts): view selection
- [`src/render/mermaid.ts`](/Users/djeglin/Projects/HeadlessCo/cmmf-to-mermaid-renderer/src/render/mermaid.ts): Mermaid ER rendering
- [`src/render/export.ts`](/Users/djeglin/Projects/HeadlessCo/cmmf-to-mermaid-renderer/src/render/export.ts): optional image export

## Known Limitations

- Mermaid ER diagrams require a relationship label, so the renderer currently emits empty labels instead of omitting them completely
- Mermaid ER layout is less controllable than flowcharts, especially for direction and fine-grained styling
- field comments are currently used for optionality markers rather than richer multi-column formatting
