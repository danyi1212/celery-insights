import { readFileSync } from "node:fs"
import path from "node:path"

type TsconfigPaths = Record<string, string[]>

type ViteAlias = {
  find: string
  replacement: string
}

export const loadTsconfigAliases = (tsconfigPath = path.resolve(process.cwd(), "tsconfig.json")): ViteAlias[] => {
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8")) as {
    compilerOptions?: { baseUrl?: string; paths?: TsconfigPaths }
  }

  const baseUrl = tsconfig.compilerOptions?.baseUrl ?? "."
  const paths = tsconfig.compilerOptions?.paths ?? {}
  const baseDir = path.resolve(path.dirname(tsconfigPath), baseUrl)

  return Object.entries(paths)
    .sort(([left], [right]) => right.length - left.length)
    .flatMap(([key, values]) => {
      const target = values[0]
      if (!target) return []

      if (key.endsWith("/*") && target.endsWith("/*")) {
        return [{ find: key.slice(0, -2), replacement: path.resolve(baseDir, target.slice(0, -2)) }]
      }

      if (key.endsWith("*") && target.endsWith("*")) {
        return [{ find: key.slice(0, -1), replacement: path.resolve(baseDir, target.slice(0, -1)) }]
      }

      return [{ find: key, replacement: path.resolve(baseDir, target) }]
    })
}
