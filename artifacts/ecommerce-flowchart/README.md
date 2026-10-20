# Ecommerce field-node flowchart preview

Paste the entire contents of [ecommerce-flowchart.mmd](ecommerce-flowchart.mmd) into a Mermaid editor. It contains all **34 content types, 201 fields and 64 relationships** from Studio's large ecommerce example.

Alternatively, open [index.html](index.html) in a browser and use **Copy Mermaid source**. The viewer works offline, includes zoom controls, and offers a [smaller Product comparison](product-flowchart.mmd): seven types, 52 fields and all 11 relationships between those types.

Each content type is a subgraph. Its dark header shows the model ID, and each field is a separate node. Solid arrows represent references; dashed arrows represent embedded objects. Arrows start at the field that defines the relationship and end at the target type's header. Purple fields are references; green fields are objects. Invisible links encourage the original field order and are not content relationships. Required/optional and localization appear on fields; one/many on edges describes only the outgoing field, with no invented inverse cardinality.

This tests whether field-specific connections help. It does not implement table-row ports or replace the production ER renderer. Mermaid may reposition nodes within groups; crossing edges and substantial whitespace remain. The full example renders at approximately 8204 × 10266px with Mermaid 11.12.0, so zoom is essential. The source includes a standard Mermaid init directive for plain SVG labels and straight line segments; hosts that disallow custom configuration may render differently.

The renderer check parsed the Mermaid graph and verified that every visible relationship starts at a field node and ends at a model header. Both examples rendered in Chromium, their screenshots were inspected, and the viewer's source selection was checked. The viewer includes a textarea fallback if clipboard access is unavailable.

## Reproduce

From the repository root:

```sh
node scripts/preview-ecommerce-flowchart.mjs
```

The generator also accepts a Studio workspace JSON path as its first argument. [source-models.json](source-models.json) preserves the original model objects used for this preview, and [metrics.json](metrics.json) records the source hash and counts. To regenerate from that snapshot:

```sh
node scripts/preview-ecommerce-flowchart.mjs artifacts/ecommerce-flowchart/source-models.json
```

To regenerate the SVGs, screenshots and offline viewer, reuse the neighbouring Studio Playwright installation and cached Chromium, and install the pinned Mermaid dependency locally:

```sh
npm install --prefix .tmp/mermaid-tools --no-audit --no-fund mermaid@11.12.0
node scripts/render-flowchart-preview.mjs
```

Related investigation: [issue #1](https://github.com/headless-company/cmmf-to-mermaid-renderer/issues/1). This is an evaluation artifact, not a completed fix for that issue.
