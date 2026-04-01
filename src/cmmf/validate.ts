import AjvModule, { type ErrorObject } from "ajv";
import { readText } from "../utils/fs.js";
import { manifestSchema, modelSchema, type CmmfManifest, type CmmfModel, type CmmfSource, type ValidationIssue } from "../types.js";

const Ajv = AjvModule as unknown as new (options?: Record<string, unknown>) => {
  compile: (schema: unknown) => {
    (data: unknown): boolean;
    errors?: ErrorObject[] | null;
  };
};

export interface CmmfValidators {
  validateManifest(manifest: unknown): ValidationIssue[];
  validateModel(model: unknown): ValidationIssue[];
  assertManifestValid(manifest: CmmfManifest): void;
  assertModelValid(model: CmmfModel): void;
}

export async function createCmmfValidators(source: CmmfSource): Promise<CmmfValidators> {
  const schemaText = await readText(source.schemaPath);
  const schemaJson = JSON.parse(schemaText) as unknown;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateJsonSchema = ajv.compile(schemaJson);

  function validateManifest(manifest: unknown): ValidationIssue[] {
    const parsed = manifestSchema.safeParse(manifest);
    if (parsed.success) {
      return [];
    }
    return parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
  }

  function validateModel(model: unknown): ValidationIssue[] {
    const zodResult = modelSchema.safeParse(model);
    const zodIssues = zodResult.success
      ? []
      : zodResult.error.issues.map((issue) => ({
          path: issue.path.join(".") || "(root)",
          message: issue.message,
        }));
    const schemaValid = validateJsonSchema(model);
    const schemaIssues = schemaValid
      ? []
      : (validateJsonSchema.errors ?? []).map((issue: ErrorObject) => ({
          path: issue.instancePath || "(root)",
          message: issue.message ?? "Schema validation failed.",
        }));
    return [...zodIssues, ...schemaIssues];
  }

  function assertManifestValid(manifest: CmmfManifest): void {
    const issues = validateManifest(manifest);
    if (issues.length > 0) {
      throw new Error(`Manifest validation failed:\n${formatIssues(issues)}`);
    }
  }

  function assertModelValid(model: CmmfModel): void {
    const issues = validateModel(model);
    if (issues.length > 0) {
      throw new Error(`Model validation failed for ${model.id}:\n${formatIssues(issues)}`);
    }
  }

  return {
    validateManifest,
    validateModel,
    assertManifestValid,
    assertModelValid,
  };
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => `- ${issue.path}: ${issue.message}`).join("\n");
}
