import { parseDocument } from "yaml";

export function parseYaml<T>(source: string): T {
  const doc = parseDocument(source);
  if (doc.errors.length > 0) {
    throw new Error(doc.errors.map((error) => error.message).join("\n"));
  }
  return doc.toJS() as T;
}
