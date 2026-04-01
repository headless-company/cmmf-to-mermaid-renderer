import type { DiagramEdge, DiagramGraph, DiagramNode, RenderOptions } from "../types.js";

export function renderMermaid(diagram: DiagramGraph, _options: RenderOptions = {}): string {
  const lines = ["erDiagram"];
  lines.push(`    direction ${diagram.direction}`);
  const ids = new Map<string, string>();
  for (const node of diagram.nodes) {
    ids.set(node.id, toEntityId(node));
  }

  for (const edge of diagram.edges) {
    const fromId = ids.get(edge.from);
    const toId = ids.get(edge.to);
    if (!fromId || !toId) {
      continue;
    }
    lines.push(`    ${fromId} ${renderRelationship(edge)} ${toId} : ${renderRelationshipLabel(edge)}`);
  }

  for (const node of diagram.nodes) {
    lines.push(`    ${ids.get(node.id)} {`);
    const attributes = node.fields.length > 0 ? node.fields.map((field) => `        ${renderAttribute(field)}`) : ["        string kind"];
    lines.push(...attributes);
    lines.push("    }");
  }

  return lines.join("\n");
}

function renderRelationship(edge: DiagramEdge): string {
  const targetCardinality = edge.cardinality ?? (edge.list ? "many" : "one");
  const left = "||";
  const right =
    targetCardinality === "many"
      ? edge.required
        ? "|{"
        : "o{"
      : edge.required
        ? "||"
        : "o|";
  return `${left}--${right}`;
}

function renderRelationshipLabel(edge: DiagramEdge): string {
  return "\"\"";
}

function renderAttribute(field: DiagramNode["fields"][number]): string {
  const displayName = renderAttributeDisplayName(field);
  const type = renderAttributeType(field);
  const comment = renderAttributeComment(field);
  return `${displayName} ${type}${comment ? ` "${comment}"` : ""}`;
}

function renderAttributeType(field: DiagramNode["fields"][number]): string {
  if (field.type === "reference") {
    return field.list ? "reference_many" : "reference";
  }
  if (field.type === "object") {
    return field.list ? "object_many" : "object";
  }
  if (field.list) {
    return `${field.type}_list`;
  }
  return field.type;
}

function renderAttributeComment(field: DiagramNode["fields"][number]): string {
  if (!field.required) {
    return "*";
  }
  if (field.localisation) {
    return "localized";
  }
  return "";
}

function toEntityId(node: DiagramNode): string {
  const base = node.modelId ?? node.id;
  const sanitized = base.replace(/[^A-Za-z0-9_]/g, "_");
  const normalized = /^[A-Za-z_]/.test(sanitized) ? sanitized : `M_${sanitized}`;
  return normalized.toUpperCase();
}

function sanitizeAttributeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function renderAttributeDisplayName(field: DiagramNode["fields"][number]): string {
  const source = field.fieldName.trim().length > 0 ? field.fieldName : field.fieldId;
  return sanitizeAttributeName(toPascalCase(source));
}

function toPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
