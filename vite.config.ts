import { readFile } from "node:fs/promises"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import mdx from "@mdx-js/rollup"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"
import { loadTsconfigAliases } from "./tooling/tsconfig-aliases"

const DOCS_SOURCE_SUFFIX = ".source"
const DOCS_SOURCE_PREFIX = "\0docs-source:"

const docsSourcePlugin = () => ({
  name: "docs-source-plugin",
  enforce: "pre" as const,
  async resolveId(
    this: { resolve: (source: string, importer?: string, options?: object) => Promise<{ id: string } | null> },
    source: string,
    importer?: string,
  ) {
    if (!source.endsWith(DOCS_SOURCE_SUFFIX)) {
      return null
    }

    const target = source.slice(0, -DOCS_SOURCE_SUFFIX.length)
    const resolved = await this.resolve(target, importer, { skipSelf: true })

    if (!resolved) {
      return null
    }

    return `${DOCS_SOURCE_PREFIX}${resolved.id}`
  },
  async load(id: string) {
    if (!id.startsWith(DOCS_SOURCE_PREFIX)) {
      return null
    }

    const resolvedId = id.slice(DOCS_SOURCE_PREFIX.length)
    const [filepath] = resolvedId.split("?")
    const source = await readFile(filepath, "utf8")

    return `export default ${JSON.stringify(source)}`
  },
})

export default defineConfig({
  base: "./",
  define: { "import.meta.env.VITE_VERCEL_ANALYTICS": JSON.stringify(process.env.VERCEL === "1") },
  plugins: [
    tailwindcss(),
    TanStackRouterVite({
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    docsSourcePlugin(),
    mdx({
      providerImportSource: "@mdx-js/react",
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeSlug],
    }),
    react(),
  ],
  // Keep the WASM loader path intact for demo mode.
  optimizeDeps: {
    exclude: ["@surrealdb/wasm"],
  },
  assetsInclude: ["**/*.wasm"],
  resolve: {
    alias: loadTsconfigAliases(),
  },
  server: {
    port: 3000,
    // Bun owns application routes; Python is only the private Celery bridge.
    proxy: {
      "/mcp": {
        target: "http://localhost:8555",
        changeOrigin: true,
        secure: false,
      },
      "/metrics": {
        target: "http://localhost:8555",
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: "http://localhost:8555",
        changeOrigin: true,
        secure: false,
      },
      "/health": {
        target: "http://localhost:8555",
        changeOrigin: true,
        secure: false,
      },
      "/surreal": {
        target: "ws://localhost:8555",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
