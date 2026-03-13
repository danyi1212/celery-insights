import { readFile } from "node:fs/promises"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import tsConfigPaths from "vite-tsconfig-paths"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import mdx from "@mdx-js/rollup"
import rehypeSlug from "rehype-slug"
import remarkGfm from "remark-gfm"

const DOCS_SOURCE_SUFFIX = ".source"
const DOCS_SOURCE_PREFIX = "\0docs-source:"

const docsSourcePlugin = () => ({
    name: "docs-source-plugin",
    enforce: "pre" as const,
    async resolveId(source: string, importer?: string) {
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
    plugins: [
        tailwindcss(),
        tsConfigPaths({ projects: ["./tsconfig.json"] }),
        TanStackRouterVite({
            routesDirectory: "app/routes",
            generatedRouteTree: "app/routeTree.gen.ts",
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
    define: {
        // react-joyrider uses the global object, even though it doesn't exist in the browser.
        // https://github.com/vitejs/vite/discussions/5912
        // https://github.com/bevacqua/dragula/issues/602#issuecomment-1296313369
        global: "window",
    },
    server: {
        port: 3000,
        proxy: {
            "/metrics": {
                target: "http://localhost:8556",
                changeOrigin: true,
                secure: false,
            },
            "/api": {
                target: "http://localhost:8556",
                changeOrigin: true,
                secure: false,
            },
            "/ws": {
                target: "ws://localhost:8556",
                changeOrigin: true,
                secure: false,
                ws: true,
            },
            "/health": {
                target: "http://localhost:8556",
                changeOrigin: true,
                secure: false,
            },
            "/surreal": {
                target: "ws://localhost:8557",
                changeOrigin: true,
                secure: false,
                ws: true,
                rewrite: (path) => path.replace(/^\/surreal/, ""),
            },
        },
    },
})
