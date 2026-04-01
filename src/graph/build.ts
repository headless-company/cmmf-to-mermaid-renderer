import type { CmmfRepo, RenderWarning, VisualField, VisualGraph, VisualGraphEdge, VisualGraphNode } from "../types.js";

function makeModelLabel(node: { name: string; id: string; kind: string }): string {
  return `${node.name}\n${node.id} (${node.kind})`;
}

function makeMissingNode(targetId: string): VisualGraphNode {
  return {
    id: `missing:${targetId}`,
    modelId: targetId,
    label: `${targetId}\n(missing)`,
    kind: "missing",
    tags: [],
    fields: [],
    missing: true,
  };
}

export function buildVisualGraph(repo: CmmfRepo): VisualGraph {
  const nodes = new Map<string, VisualGraphNode>();
  const edges: VisualGraphEdge[] = [];
  const warnings: RenderWarning[] = [...repo.warnings];
  const warningKeys = new Set(warnings.map((warning) => `${warning.code}:${warning.modelId ?? ""}:${warning.fieldId ?? ""}:${warning.targetId ?? ""}`));

  for (const modelFile of repo.modelFiles) {
    const fields: VisualField[] = modelFile.model.fields.map((field) => ({
      fieldId: field.id,
      fieldName: field.name ?? field.id,
      type: field.type,
      required: field.required,
      localisation: field.localisation,
      list: field.list ?? false,
      objectType: field.objectType,
      targets: field.targets ?? [],
      relation: field.relation,
    }));

    nodes.set(modelFile.model.id, {
      id: modelFile.model.id,
      modelId: modelFile.model.id,
      label: makeModelLabel(modelFile.model),
      kind: modelFile.model.kind,
      description: modelFile.model.description,
      tags: modelFile.model.tags ?? [],
      fields,
    });
  }

  for (const modelFile of repo.modelFiles) {
    for (const field of modelFile.model.fields) {
      if (field.type === "reference") {
        const targets = field.targets ?? [];
        for (const targetId of targets) {
          const hasTarget = nodes.has(targetId);
          if (!hasTarget) {
            nodes.set(`missing:${targetId}`, makeMissingNode(targetId));
            addWarning(warnings, warningKeys, {
              code: "missing-target-model",
              message: `Reference field ${modelFile.model.id}.${field.id} points to missing model ${targetId}.`,
              modelId: modelFile.model.id,
              fieldId: field.id,
              targetId,
            });
          }
          edges.push({
            id: `${modelFile.model.id}:${field.id}:reference:${targetId}`,
            from: modelFile.model.id,
            to: hasTarget ? targetId : `missing:${targetId}`,
            fieldId: field.id,
            fieldName: field.name ?? field.id,
            type: "reference",
            required: field.required,
            cardinality: field.relation?.cardinality ?? (field.list ? "many" : undefined),
            ownership: field.relation?.ownership,
            ordered: field.relation?.ordered,
            uniqueItems: field.relation?.uniqueItems,
            list: field.list ?? false,
            missingTarget: !hasTarget,
          });
        }
      }

      if (field.type === "object") {
        const targetId = field.objectType;
        if (!targetId) {
          continue;
        }
        const hasTarget = nodes.has(targetId);
        if (!hasTarget) {
          nodes.set(`missing:${targetId}`, makeMissingNode(targetId));
          addWarning(warnings, warningKeys, {
            code: "missing-target-model",
            message: `Object field ${modelFile.model.id}.${field.id} points to missing model ${targetId}.`,
            modelId: modelFile.model.id,
            fieldId: field.id,
            targetId,
          });
        }
        edges.push({
          id: `${modelFile.model.id}:${field.id}:object:${targetId}`,
          from: modelFile.model.id,
          to: hasTarget ? targetId : `missing:${targetId}`,
          fieldId: field.id,
          fieldName: field.name ?? field.id,
          type: "object",
          required: field.required,
          list: field.list ?? false,
          missingTarget: !hasTarget,
        });
      }
    }
  }

  return { nodes, edges, warnings };
}

function addWarning(warnings: RenderWarning[], warningKeys: Set<string>, warning: RenderWarning): void {
  const key = `${warning.code}:${warning.modelId ?? ""}:${warning.fieldId ?? ""}:${warning.targetId ?? ""}`;
  if (warningKeys.has(key)) {
    return;
  }
  warningKeys.add(key);
  warnings.push(warning);
}
