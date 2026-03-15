import { render, screen, waitFor } from "@test-utils"
import userEvent from "@testing-library/user-event"
import useSettingsStore, { resetSettings } from "@stores/use-settings-store"
import { DownloadDebugBundleButton } from "./download-debug-bundle-button"

describe("DownloadDebugBundleButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetSettings()
    useSettingsStore.setState({ demo: false })
  })

  it("opens a dialog and downloads a redacted bundle by default", async () => {
    const user = userEvent.setup()
    const blob = new Blob(["bundle"], { type: "application/zip" })
    const responseHeaders = new Headers({
      "Content-Disposition": 'attachment; filename="celery-insights-debug-bundle-2026-03-14T21-33-08-742Z.zip"',
    })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      headers: responseHeaders,
      blob: async () => blob,
    } as Response)
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:debug-bundle")
    const revokeObjectUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    render(<DownloadDebugBundleButton />)

    await user.click(screen.getByRole("button", { name: /download diagnostics/i }))
    expect(screen.getByText(/bundle includes effective config/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /download bundle/i }))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    const request = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(request.includeSecrets).toBe(false)
    expect(request.settings).toBeTruthy()
    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalled()
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("celery-insights-debug-bundle-2026-03-14T21-33-08-742Z.zip")
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:debug-bundle")
  })

  it("shows preparing feedback while the bundle request is in flight", async () => {
    const user = userEvent.setup()
    let resolveResponse!: (value: Response) => void
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve
        }),
    )
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:debug-bundle")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)

    render(<DownloadDebugBundleButton />)

    await user.click(screen.getByRole("button", { name: /download diagnostics/i }))
    await user.click(screen.getByRole("button", { name: /download bundle/i }))

    expect(screen.getAllByText("Preparing bundle...").length).toBeGreaterThan(0)
    expect(screen.getByText("Preparing debug bundle. This can take a moment.")).toBeInTheDocument()

    resolveResponse({
      ok: true,
      blob: async () => new Blob(["bundle"], { type: "application/zip" }),
    } as Response)

    await waitFor(() => {
      expect(screen.queryByText("Preparing debug bundle. This can take a moment.")).not.toBeInTheDocument()
    })
  })

  it("shows an inline error when bundle preparation fails", async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Bundle assembly failed" }),
    } as Response)

    render(<DownloadDebugBundleButton />)

    await user.click(screen.getByRole("button", { name: /download diagnostics/i }))
    await user.click(screen.getByRole("button", { name: /download bundle/i }))

    await waitFor(() => {
      expect(screen.getByText("Bundle preparation failed")).toBeInTheDocument()
    })
    expect(screen.getByText("Bundle assembly failed")).toBeInTheDocument()
  })
})
