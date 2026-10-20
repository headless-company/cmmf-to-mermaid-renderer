// Preview only; no change to the production renderer.
// Run from the repository root: node scripts/preview-ecommerce-flowchart.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const input = path.resolve(process.argv[2] ?? '../cmmf-visual-editor/examples/ecommerce.cmmf.json');
const out = path.resolve('artifacts/ecommerce-flowchart');
const raw = await readFile(input, 'utf8');
const board = JSON.parse(raw);
const models = [...board.models].sort((a, b) => a.id.localeCompare(b.id));
const byId = new Map(models.map((model, index) => [model.id, `m${index}`]));
assert.equal(byId.size, models.length, 'Model IDs must be unique');
const quote = text => '"' + String(text).replaceAll('&', '#38;').replaceAll('"', '#34;').replaceAll('<', '#60;').replaceAll('>', '#62;').replaceAll('\n', ' ') + '"';

function render(selected) {
  const selectedIds = new Set(selected.map(model => model.id));
  const lines = [
    '%%{init: {"flowchart": {"htmlLabels": false, "curve": "linear"}}}%%',
    'flowchart TB',
    '    %% Each field is a real node; relationships originate at that field.',
    '    %% Solid arrows: references. Dashed arrows: embedded objects.',
    '    %% Invisible links retain field order and are not content relationships.',
    '    %% Targets are model ID header nodes, not fields on the target model.',
    '    classDef model fill:#25233b,color:#ffffff,stroke:#25233b,font-weight:bold',
    '    classDef scalar fill:#ffffff,color:#25233b,stroke:#c9c7d4',
    '    classDef reference fill:#ede9ff,color:#25233b,stroke:#7963cb,stroke-width:2px',
    '    classDef embedded fill:#e5f5f0,color:#173e34,stroke:#418976,stroke-width:2px',
  ];
  const edges = [];
  let fields = 0;
  for (const model of selected) {
    const id = byId.get(model.id);
    lines.push(`    subgraph g${id.slice(1)}[${quote(`${model.name} · ${model.kind}`)}]`, '        direction TB', `        ${id}[${quote(model.id)}]:::model`);
    let previous = id;
    for (const [index, field] of model.fields.entries()) {
      const fid = `${id}_f${index}`;
      const type = field.type + (field.list ? '[]' : '');
      const flags = [field.required ? 'required' : 'optional', ...(field.localisation ? ['localized'] : [])];
      const style = field.type === 'reference' ? 'reference' : field.type === 'object' ? 'embedded' : 'scalar';
      lines.push(`        %% ${model.id}.${field.id}`, `        ${fid}[${quote(`${field.name ?? field.id} : ${type} · ${flags.join(' · ')}`)}]:::${style}`, `        ${previous} ~~~ ${fid}`);
      previous = fid;
      fields++;
      const targets = field.type === 'reference' ? field.targets ?? [] : field.type === 'object' && field.objectType ? [field.objectType] : [];
      for (const target of targets) {
        assert(byId.has(target), `Unresolved target ${model.id}.${field.id}: ${target}`);
        if (!selectedIds.has(target)) continue;
        const many = field.relation?.cardinality === 'many' || (!field.relation?.cardinality && field.list);
        const label = (field.type === 'object' ? 'embedded' : 'reference') + (many ? ' · many' : ' · one');
        edges.push(`    ${fid} ${field.type === 'object' ? '-.->' : '-->'}|${quote(label)}| ${byId.get(target)}`);
      }
    }
    lines.push('    end', '');
  }
  lines.push('    %% Content relationships', ...edges);
  return { text: lines.join('\n') + '\n', models: selected.length, fields, relationships: edges.length };
}

await mkdir(out, { recursive: true });
const full = render(models);
assert.equal(full.fields, models.reduce((sum, model) => sum + model.fields.length, 0));
await writeFile(path.join(out, 'ecommerce-flowchart.mmd'), full.text);
// A small orientation check for comparison; the primary artifact is the full model.
const product = models.find(model => model.id === 'product');
assert(product, 'Product model is required for the focused comparison');
const targets = new Set([product.id, ...product.fields.flatMap(field => field.type === 'reference' ? field.targets ?? [] : field.type === 'object' && field.objectType ? [field.objectType] : [])]);
const focused = render(models.filter(model => targets.has(model.id)));
await writeFile(path.join(out, 'product-flowchart.mmd'), focused.text);
await writeFile(path.join(out, 'source-models.json'), JSON.stringify({ name: board.name, models: board.models }, null, 2) + '\n');
await writeFile(path.join(out, 'metrics.json'), JSON.stringify({ input, sha256: createHash('sha256').update(raw).digest('hex'), full: { models: full.models, fields: full.fields, relationships: full.relationships }, focused: { models: focused.models, fields: focused.fields, relationships: focused.relationships } }, null, 2) + '\n');
console.log(JSON.stringify({ output: out, models: full.models, fields: full.fields, relationships: full.relationships, bytes: Buffer.byteLength(full.text) }, null, 2));
