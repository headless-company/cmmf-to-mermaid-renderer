import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function listYamlFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  if (await pathExists(rootDir)) {
    await walk(rootDir);
  }

  return results.sort();
}
