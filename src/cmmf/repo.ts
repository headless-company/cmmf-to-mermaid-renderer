import path from "node:path";
import type { CmmfField, CmmfManifest, CmmfModel, CmmfRepo, CmmfSource, LoadCmmfRepoOptions, NormalizedField, NormalizedModel } from "../types.js";
import { manifestSchema, modelSchema } from "../types.js";
import { listYamlFiles, pathExists, readText } from "../utils/fs.js";
import { parseYaml } from "../utils/yaml.js";
import { resolveCmmfSource } from "./source.js";
import { createCmmfValidators, formatIssues } from "./validate.js";

async function findManifestPath(rootDir: string): Promise<string | null> {
  for (const candidate of ["manifest.yaml", "manifest.yml"]) {
    const filePath = path.join(rootDir, candidate);
    if (await pathExists(filePath)) {
      return filePath;
    }
  }
  return null;
}

function inferModelsDir(rootDir: string, manifest: CmmfManifest | null): string {
  return path.resolve(rootDir, manifest?.modelsPath ?? "./models");
}

function normalizeField(field: CmmfField, manifest: CmmfManifest | null): NormalizedField {
  return {
    ...field,
    required: field.required ?? manifest?.defaults?.required ?? false,
    localisation: field.localisation ?? manifest?.defaults?.localisation ?? false,
  };
}

function normalizeModel(model: CmmfModel, manifest: CmmfManifest | null): NormalizedModel {
  return {
    ...model,
    fields: model.fields.map((field) => normalizeField(field, manifest)),
  };
}

async function loadManifest(rootDir: string, source: CmmfSource): Promise<{ manifestPath: string | null; manifest: CmmfManifest | null }> {
  const manifestPath = await findManifestPath(rootDir);
  if (!manifestPath) {
    return { manifestPath: null, manifest: null };
  }

  const validators = await createCmmfValidators(source);
  const manifest = manifestSchema.parse(parseYaml<CmmfManifest>(await readText(manifestPath)));
  validators.assertManifestValid(manifest);
  return { manifestPath, manifest };
}

export async function loadCmmfRepo(options: LoadCmmfRepoOptions): Promise<CmmfRepo> {
  const rootDir = path.resolve(options.repoPath);
  const source = await resolveCmmfSource(options.cmmfRepoPath);
  const validators = await createCmmfValidators(source);
  const { manifestPath, manifest } = await loadManifest(rootDir, source);
  const modelsDir = inferModelsDir(rootDir, manifest);
  const modelFiles = await loadModelFiles(modelsDir, manifest, validators);
  const modelsById = new Map(modelFiles.map((file) => [file.model.id, file]));

  return {
    rootDir,
    manifestPath,
    manifest,
    modelsDir,
    modelFiles,
    modelsById,
    warnings: [],
    source,
  };
}

async function loadModelFiles(
  modelsDir: string,
  manifest: CmmfManifest | null,
  validators: Awaited<ReturnType<typeof createCmmfValidators>>,
): Promise<Array<{ path: string; model: NormalizedModel }>> {
  if (!(await pathExists(modelsDir))) {
    return [];
  }

  const files = await listYamlFiles(modelsDir);
  const entries = await Promise.all(
    files.map(async (filePath) => {
      const rawModel = parseYaml<CmmfModel>(await readText(filePath));
      const parsed = modelSchema.safeParse(rawModel);
      if (!parsed.success) {
        throw new Error(`Model validation failed for ${filePath}:\n${formatIssues(parsed.error.issues.map((issue) => ({
          path: issue.path.join(".") || "(root)",
          message: issue.message,
        })))}`);
      }
      validators.assertModelValid(parsed.data);
      return {
        path: filePath,
        model: normalizeModel(parsed.data, manifest),
      };
    }),
  );

  return entries.sort((left, right) => left.model.id.localeCompare(right.model.id));
}
