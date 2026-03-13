import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "../fixtures/base"

const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../app/content/docs")
const githubRepoUrl = "https://github.com/danyi1212/celery-insights/edit/main"

const documentationPages = [
    {
        title: "Quick Start",
        href: "/documentation/setup",
        sourcePath: "frontend/app/content/docs/setup.mdx",
        tocHeading: "Operator notes",
    },
    {
        title: "Configuration",
        href: "/documentation/configuration",
        sourcePath: "frontend/app/content/docs/configuration.mdx",
    },
    {
        title: "Deployment Patterns",
        href: "/documentation/deployment-patterns",
        sourcePath: "frontend/app/content/docs/deployment-patterns.mdx",
    },
    {
        title: "Kubernetes and HPA",
        href: "/documentation/kubernetes",
        sourcePath: "frontend/app/content/docs/kubernetes.mdx",
    },
    {
        title: "Celery Cluster Setups",
        href: "/documentation/celery-clusters",
        sourcePath: "frontend/app/content/docs/celery-clusters.mdx",
    },
    {
        title: "Production Notes",
        href: "/documentation/production-notes",
        sourcePath: "frontend/app/content/docs/production-notes.mdx",
    },
] as const

test.describe("Documentation", () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 1100 })
    })

    test("redirects the documentation index to quick start", async ({ page }) => {
        await page.goto("/documentation/")

        await expect(page).toHaveURL(/\/documentation\/setup$/)
        await expect(page.getByRole("heading", { name: "Quick Start" })).toBeVisible()
    })

    for (const doc of documentationPages) {
        test(`renders ${doc.title} with docs actions`, async ({ page }) => {
            await page.goto(doc.href)

            await expect(page.getByRole("heading", { name: doc.title })).toBeVisible()
            await expect(page.getByRole("button", { name: "Copy as Markdown" })).toBeVisible()
            await expect(page.getByRole("link", { name: "Edit on GitHub" })).toHaveAttribute(
                "href",
                `${githubRepoUrl}/${doc.sourcePath}`,
            )
        })
    }

    test("navigates between documentation pages from the docs sidebar", async ({ page }) => {
        await page.goto("/documentation/setup")
        await expect(page.getByRole("heading", { name: "Quick Start" })).toBeVisible()

        await page.getByRole("link", { name: "Kubernetes and HPA" }).click()
        await expect(page).toHaveURL(/\/documentation\/kubernetes$/)
        await expect(page.getByRole("heading", { name: "Kubernetes and HPA" })).toBeVisible()

        await page.getByRole("link", { name: "Production Notes" }).click()
        await expect(page).toHaveURL(/\/documentation\/production-notes$/)
        await expect(page.getByRole("heading", { name: "Production Notes" })).toBeVisible()
    })

    test("updates the url hash when using the table of contents", async ({ page }) => {
        await page.goto(documentationPages[0].href)
        await expect(page.getByRole("heading", { name: documentationPages[0].title })).toBeVisible()

        await page.getByRole("link", { name: documentationPages[0].tocHeading! }).click()

        await expect(page).toHaveURL(/\/documentation\/setup#operator-notes$/)
        await expect(page.locator("#operator-notes")).toBeVisible()
    })

    test("copies the raw markdown source for a documentation page", async ({ page }) => {
        const sourcePath = resolve(docsDir, "configuration.mdx")
        const expectedMarkdown = readFileSync(sourcePath, "utf8")

        await page.context().grantPermissions(["clipboard-read", "clipboard-write"])

        await page.goto("/documentation/configuration")
        await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible()

        await page.getByRole("button", { name: "Copy as Markdown" }).click()

        await expect(page.getByRole("button", { name: "Copied Markdown" })).toBeVisible()

        const copiedMarkdown = await page.evaluate(() => navigator.clipboard.readText())

        expect(copiedMarkdown).toBe(expectedMarkdown)
        expect(copiedMarkdown).toContain("#### BROKER_URL")
        expect(copiedMarkdown).not.toContain("function MDXContent")
    })
})
