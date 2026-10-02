import { Outlet } from "@tanstack/react-router"

export default function DocsShell() {
  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-6 md:px-6 lg:px-8">
      <Outlet />
    </div>
  )
}
