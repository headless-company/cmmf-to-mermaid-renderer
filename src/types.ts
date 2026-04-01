import { z } from "zod";

export const modelKinds = ["entry", "component", "object", "taxonomy", "settings"] as const;
export const fieldTypes = [
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "slug",
  "enum",
  "richText",
  "asset",
  "json",
  "object",
  "reference",
] as const;
export const relationCardinalities = ["one", "many"] as const;
export const relationOwnerships = ["linked", "contained"] as const;
export const diagramViews = ["model", "organism", "landscape"] as const;
export const diagramDirections = ["LR", "TB"] as const;
export const imageFormats = ["svg", "png"] as const;

const previewSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
  })
  .strict()
  .partial();

export const editorialSchema = z
  .object({
    labelField: z.string().optional(),
    preview: previewSchema.optional(),
    helpText: z.string().optional(),
  })
  .strict()
  .partial();

export const relationSchema = z
  .object({
    cardinality: z.enum(relationCardinalities).optional(),
    ordered: z.boolean().optional(),
    uniqueItems: z.boolean().optional(),
    minItems: z.number().optional(),
    maxItems: z.number().optional(),
    ownership: z.enum(relationOwnerships).optional(),
  })
  .strict()
  .partial();

export const fieldSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]+$/),
    name: z.string().optional(),
    description: z.string().optional(),
    type: z.enum(fieldTypes),
    required: z.boolean().optional(),
    localisation: z.boolean().optional(),
    default: z.unknown().optional(),
    list: z.boolean().optional(),
    objectType: z.string().optional(),
    targets: z.array(z.string()).optional(),
    relation: relationSchema.optional(),
    values: z.array(z.string()).optional(),
    validations: z.record(z.string(), z.unknown()).optional(),
    editorial: editorialSchema.optional(),
    translationHints: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === "object" && !value.objectType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Object fields must include objectType.",
        path: ["objectType"],
      });
    }
    if (value.type === "reference" && (!value.targets || value.targets.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reference fields must include targets.",
        path: ["targets"],
      });
    }
    if (value.type === "enum" && (!value.values || value.values.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enum fields must include values.",
        path: ["values"],
      });
    }
  });

export const modelSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string(),
  kind: z.enum(modelKinds),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  localisation: z.boolean().optional(),
  singleton: z.boolean().optional(),
  fields: z.array(fieldSchema),
  editorial: editorialSchema.optional(),
  governance: z.record(z.string(), z.unknown()).optional(),
  translationHints: z.record(z.string(), z.unknown()).optional(),
});

export const manifestSchema = z.object({
  specVersion: z.literal(1),
  namespace: z.string().min(1),
  modelsPath: z.string().optional(),
  defaults: z
    .object({
      required: z.boolean().optional(),
      localisation: z.boolean().optional(),
    })
    .strict()
    .partial()
    .optional(),
});

export type DiagramView = (typeof diagramViews)[number];
export type DiagramDirection = (typeof diagramDirections)[number];
export type ImageFormat = (typeof imageFormats)[number];
export type Relation = z.infer<typeof relationSchema>;
export type Editorial = z.infer<typeof editorialSchema>;
export type CmmfField = z.infer<typeof fieldSchema>;
export type CmmfModel = z.infer<typeof modelSchema>;
export type CmmfManifest = z.infer<typeof manifestSchema>;

export interface ParsedModelFile {
  path: string;
  model: CmmfModel;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface LoadCmmfRepoOptions {
  repoPath: string;
  cmmfRepoPath?: string;
}

export interface CmmfModelFile {
  path: string;
  model: NormalizedModel;
}

export interface CmmfRepo {
  rootDir: string;
  manifestPath: string | null;
  manifest: CmmfManifest | null;
  modelsDir: string;
  modelFiles: CmmfModelFile[];
  modelsById: Map<string, CmmfModelFile>;
  warnings: RenderWarning[];
  source: CmmfSource;
}

export interface CmmfSource {
  rootDir: string;
  schemaPath: string;
  specPath: string;
  relationshipsDocPath: string;
  revision: string | null;
  branch: string | null;
  remoteUrl: string | null;
}

export interface NormalizedField extends CmmfField {
  required: boolean;
  localisation: boolean;
}

export interface NormalizedModel extends Omit<CmmfModel, "fields"> {
  fields: NormalizedField[];
}

export interface VisualField {
  fieldId: string;
  fieldName: string;
  type: CmmfField["type"];
  required: boolean;
  localisation: boolean;
  list: boolean;
  objectType?: string;
  targets: string[];
  relation?: Relation;
}

export interface VisualGraphNode {
  id: string;
  label: string;
  modelId?: string;
  kind: (typeof modelKinds)[number] | "missing" | "field";
  description?: string;
  tags: string[];
  fields: VisualField[];
  missing?: boolean;
}

export interface VisualGraphEdge {
  id: string;
  from: string;
  to: string;
  fieldId: string;
  fieldName: string;
  type: "reference" | "object";
  required?: boolean;
  cardinality?: Relation["cardinality"];
  ownership?: Relation["ownership"];
  ordered?: boolean;
  uniqueItems?: boolean;
  list?: boolean;
  missingTarget?: boolean;
}

export interface VisualGraph {
  nodes: Map<string, VisualGraphNode>;
  edges: VisualGraphEdge[];
  warnings: RenderWarning[];
}

export interface DiagramNode extends VisualGraphNode {}

export interface DiagramEdge extends VisualGraphEdge {}

export interface DiagramGraph {
  view: DiagramView;
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  warnings: RenderWarning[];
  rootModelId?: string;
}

export interface RenderWarning {
  code: "missing-target-model" | "missing-root-model" | "missing-export-binary";
  message: string;
  modelId?: string;
  fieldId?: string;
  targetId?: string;
}

export interface DiagramSelectionOptions {
  view: DiagramView;
  modelId?: string;
  depth?: number;
  direction?: DiagramDirection;
}

export interface RenderOptions {
  direction?: DiagramDirection;
}

export interface ExportOptions {
  mermaid: string;
  outputPath: string;
  format: ImageFormat;
  cwd?: string;
}

export interface ExportResult {
  outputPath: string;
  format: ImageFormat;
}
