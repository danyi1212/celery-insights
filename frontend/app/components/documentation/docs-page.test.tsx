import { act, render, screen, waitFor } from "@test-utils"
import DocsPage from "./docs-page"

const sampleMarkdown = `## Intro

Paragraph with a [link](/documentation/configuration).

\`\`\`sh
bun test
\`\`\`
`

const renderDocsPage = (source?: { path: string; markdown: string }) =>
    render(
        <DocsPage
            title="Quick Start"
            description="Choose a topology and copy the docs when needed."
            group="Getting Started"
            source={source}
        >
            <h2 id="intro">Intro</h2>
            <p>Body content.</p>
        </DocsPage>,
    )

describe("DocsPage", () => {
    let writeText: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        if (!navigator.clipboard) {
            Object.defineProperty(navigator, "clipboard", {
                configurable: true,
                value: {
                    writeText: vi.fn(),
                },
            })
        }

        writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it("copies the exact markdown source to the clipboard", async () => {
        renderDocsPage({
            path: "frontend/app/content/docs/setup.mdx",
            markdown: sampleMarkdown,
        })

        await act(async () => {
            screen.getByRole("button", { name: "Copy as Markdown" }).click()
        })

        expect(writeText).toHaveBeenCalledWith(sampleMarkdown)
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Copied Markdown" })).toBeInTheDocument()
        })
    })

    it("shows an error state when clipboard writes fail", async () => {
        writeText.mockRejectedValueOnce(new Error("clipboard unavailable"))

        renderDocsPage({
            path: "frontend/app/content/docs/setup.mdx",
            markdown: sampleMarkdown,
        })

        await act(async () => {
            screen.getByRole("button", { name: "Copy as Markdown" }).click()
        })

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Copy Failed" })).toBeInTheDocument()
        })
    })

    it("resets the copy state after the timeout elapses", async () => {
        vi.useFakeTimers()

        renderDocsPage({
            path: "frontend/app/content/docs/setup.mdx",
            markdown: sampleMarkdown,
        })

        await act(async () => {
            screen.getByRole("button", { name: "Copy as Markdown" }).click()
        })
        expect(screen.getByRole("button", { name: "Copied Markdown" })).toBeInTheDocument()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000)
        })

        expect(screen.getByRole("button", { name: "Copy as Markdown" })).toBeInTheDocument()
    })

    it("disables copy when no markdown source is provided", () => {
        renderDocsPage()

        expect(screen.getByRole("button", { name: "Copy as Markdown" })).toBeDisabled()
    })
})
