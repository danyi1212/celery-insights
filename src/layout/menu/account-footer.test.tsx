import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@test-utils"
import { SidebarProvider } from "@components/ui/sidebar"
import AccountFooter from "./account-footer"

const state = vi.hoisted(() => ({ demo: false }))
vi.mock("@stores/use-settings-store", () => ({ default: (select: (s: typeof state) => unknown) => select(state) }))
vi.mock("@hooks/use-identity", () => ({
  useIdentity: () => ({ data: { display_name: "Alice", authentication_mode: "oidc" }, isError: false }),
}))
beforeEach(() => {
  state.demo = false
})
afterEach(() => vi.restoreAllMocks())

it("shows a readable account and signs out without confirmation", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }))
  const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {})
  render(
    <SidebarProvider>
      <AccountFooter />
    </SidebarProvider>,
  )
  expect(screen.getByText("Alice")).toBeVisible()
  expect(screen.getByText("Organization sign-in")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.stringContaining("/login?reason=signed-out")))
})
it("disables duplicate sign-out and offers retry after a network failure", async () => {
  let rejectRequest: (reason: Error) => void = () => {}
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject
      }),
  )
  render(
    <SidebarProvider>
      <AccountFooter />
    </SidebarProvider>,
  )
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
  expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled()
  expect(fetch).toHaveBeenCalledTimes(1)
  rejectRequest(new Error("offline"))
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out. Please try again.")
  expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled()
})
it("hides account actions in the embedded demo", () => {
  state.demo = true
  render(
    <SidebarProvider>
      <AccountFooter />
    </SidebarProvider>,
  )
  expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument()
})
