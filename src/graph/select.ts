import type { DiagramGraph, DiagramNode, DiagramSelectionOptions, RenderWarning, VisualGraph, VisualGraphNode } from "../types.js";

function makeMissingRootWarning(modelId: string): RenderWarning {
  return {
    code: "missing-root-model",
    message: `Model ${modelId} was not found in the CMMF repository.`,
    modelId,
  };
}

export function selectDiagramGraph(graph: VisualGraph, options: DiagramSelectionOptions): DiagramGraph {
  const direction = options.direction ?? "LR";
  const warnings = [...graph.warnings];

  if (options.view === "landscape") {
    return {
      view: "landscape",
      direction,
      nodes: [...graph.nodes.values()].filter((node) => node.kind !== "field"),
      edges: [...graph.edges],
      warnings,
    };
  }

  if (!options.modelId) {
    throw new Error(`--model is required for ${options.view} view.`);
  }

  const root = graph.nodes.get(options.modelId);
  if (!root) {
    warnings.push(makeMissingRootWarning(options.modelId));
    return {
      view: options.view,
      direction,
      nodes: [],
      edges: [],
      warnings,
      rootModelId: options.modelId,
    };
  }

  if (options.view === "organism") {
    return selectOrganismDiagram(graph, root.id, Math.max(0, options.depth ?? 2), direction, warnings);
  }

  return selectModelDiagram(graph, root, direction, warnings);
}

function selectOrganismDiagram(
  graph: VisualGraph,
  rootId: string,
  depth: number,
  direction: DiagramGraph["direction"],
  warnings: RenderWarning[],
): DiagramGraph {
  const visited = new Set<string>([rootId]);
  const queue: Array<{ nodeId: string; distance: number }> = [{ nodeId: rootId, distance: 0 }];
  const adjacency = buildAdjacency(graph);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    if (current.distance >= depth) {
      continue;
    }
    for (const neighborId of adjacency.get(current.nodeId) ?? []) {
      if (visited.has(neighborId)) {
        continue;
      }
      visited.add(neighborId);
      queue.push({ nodeId: neighborId, distance: current.distance + 1 });
    }
  }

  const nodes = [...visited]
    .map((nodeId) => graph.nodes.get(nodeId))
    .filter((node): node is DiagramNode => Boolean(node));
  const edges = graph.edges.filter((edge) => visited.has(edge.from) && visited.has(edge.to));

  return {
    view: "organism",
    direction,
    nodes: nodes.sort(sortNodes),
    edges,
    warnings,
    rootModelId: rootId,
  };
}

function selectModelDiagram(
  graph: VisualGraph,
  root: VisualGraphNode,
  direction: DiagramGraph["direction"],
  warnings: RenderWarning[],
): DiagramGraph {
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramGraph["edges"] = [];

  nodes.set(root.id, root);
  for (const field of root.fields) {
    if (field.type === "reference") {
      for (const targetId of field.targets) {
        const targetNode = graph.nodes.get(targetId) ?? graph.nodes.get(`missing:${targetId}`);
        if (!targetNode) {
          continue;
        }
        nodes.set(targetNode.id, targetNode);
        edges.push({
          id: `${root.id}:${field.fieldId}:reference:${targetNode.id}`,
          from: root.id,
          to: targetNode.id,
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          type: "reference",
          required: field.required,
          cardinality: field.relation?.cardinality ?? (field.list ? "many" : undefined),
          ownership: field.relation?.ownership,
          ordered: field.relation?.ordered,
          uniqueItems: field.relation?.uniqueItems,
          list: field.list,
          missingTarget: targetNode.kind === "missing",
        });
      }
    }

    if (field.type === "object" && field.objectType) {
      const targetNode = graph.nodes.get(field.objectType) ?? graph.nodes.get(`missing:${field.objectType}`);
      if (targetNode) {
        nodes.set(targetNode.id, targetNode);
        edges.push({
          id: `${root.id}:${field.fieldId}:object:${targetNode.id}`,
          from: root.id,
          to: targetNode.id,
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          type: "object",
          required: field.required,
          list: field.list,
          missingTarget: targetNode.kind === "missing",
        });
      }
    }
  }

  return {
    view: "model",
    direction,
    nodes: [...nodes.values()].sort(sortNodes),
    edges,
    warnings,
    rootModelId: root.id,
  };
}

function buildAdjacency(graph: VisualGraph): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, new Set());
    }
    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, new Set());
    }
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }
  return adjacency;
}

function sortNodes(left: DiagramNode, right: DiagramNode): number {
  return left.id.localeCompare(right.id);
}
