import { createFileRoute } from "@tanstack/react-router"
import { DebugSnapshotPanel } from "@components/settings/debug-snapshot-panel"
import { useSurrealDB } from "@components/surrealdb-provider"
import { DatabaseBackupPanel } from "@components/settings/database-backup-panel"
import DangerZonePanel from "@components/settings/danger-zone-panel"
import { RetentionPolicyPanel, RetentionPolicyPanelAction } from "@components/settings/retention-policy-panel"
import { ServerInfoPanel, ServerInfoPanelAction } from "@components/settings/server-info-panel"
import SettingsOverview from "@components/settings/settings-overview"
import SettingsPanel, { SettingsPanelAction } from "@components/settings/settings-panel"
import { Link } from "lucide-react"

const SectionBlock = ({
  id,
  label,
  action,
  children,
}: {
  id: string
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}) => (
  <section id={id} className="scroll-mt-24 space-y-3">
    <div className="flex items-center justify-between gap-4">
      <div className="group flex items-center gap-2">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</h2>
        <a
          href={`#${id}`}
          aria-label={`Link to ${label}`}
          className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Link className="size-4" />
        </a>
      </div>
      {action}
    </div>
    {children}
  </section>
)

const SettingsPage = () => {
  const { appConfig } = useSurrealDB()
  const snapshotEnabled = appConfig?.debugSnapshot?.enabled === true
  const sections = [
    { id: "workspace", label: "Workspace" },
    ...(snapshotEnabled ? [{ id: "snapshot", label: "Snapshot overview" }] : []),
    { id: "system", label: "System status" },
    { id: "cleanup", label: "Cleanup" },
    { id: "backups", label: "Backups" },
    { id: "danger-zone", label: "Danger zone" },
  ]

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Settings</p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">Manage your workspace and this instance.</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Change local preferences, check system health, and handle storage tasks from one place.
            </p>
          </div>
        </header>

        <SettingsOverview />

        <SectionBlock id="workspace" label="Workspace" action={<SettingsPanelAction />}>
          <SettingsPanel hideHeader />
        </SectionBlock>

        {snapshotEnabled && (
          <SectionBlock id="snapshot" label="Snapshot overview">
            <DebugSnapshotPanel hideHeader />
          </SectionBlock>
        )}

        <SectionBlock id="system" label="System status" action={<ServerInfoPanelAction />}>
          <ServerInfoPanel hideHeader />
        </SectionBlock>

        <SectionBlock id="cleanup" label="Cleanup" action={<RetentionPolicyPanelAction />}>
          <RetentionPolicyPanel hideHeader />
        </SectionBlock>

        <SectionBlock id="backups" label="Backups">
          <DatabaseBackupPanel hideHeader />
        </SectionBlock>

        <SectionBlock id="danger-zone" label="Danger zone">
          <DangerZonePanel hideHeader />
        </SectionBlock>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-3xl border bg-card/70 p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">On this page</div>
          <nav className="mt-3 flex flex-col gap-1">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-2xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  )
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
})
