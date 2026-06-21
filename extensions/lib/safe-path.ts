import { resolve } from "node:path";

/** Resolve `name` relative to `baseDir` and reject any path that escapes it. */
export function safePath(baseDir: string, name: string): string {
  const resolved = resolve(baseDir, name);
  const base = resolve(baseDir);
  if (resolved !== base && !resolved.startsWith(`${base}/`)) {
    throw new Error(`Unsafe path: "${name}" escapes ${base}`);
  }
  return resolved;
}
