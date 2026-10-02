import Panel from "@components/common/panel"
import TimeSince from "@components/common/distance-timer"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { useFailureInbox } from "@hooks/use-failure-inbox"
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react"
import React from "react"
import { Link as RouterLink } from "@tanstack/react-router"

const FailureInbox: React.FC = () => {
  const { groups, isLoading, error } = useFailureInbox(5)

  return (
    <Panel
      title="Failure Inbox"
      titleClassName="text-lg"
      headerClassName="min-h-11 px-3"
      loading={isLoading}
      error={error}
      className="overflow-hidden p-0"
    >
      {groups.length ? (
        <div>
          <div className="divide-y divide-border/70">
            {groups.map((group) => (
              <RouterLink
                key={group.key}
                to={`/tasks/${group.taskId}` as string}
                className="flex flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-accent/50 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="destructive" className="rounded-full px-2 py-0.5 text-[11px]">
                      {group.count}
                    </Badge>
                    <p className="truncate font-medium text-foreground">{group.taskType}</p>
                  </div>
                  <p className="truncate text-sm font-medium leading-tight text-destructive">{group.exception}</p>
                  {group.preview && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{group.preview}</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground md:flex-col md:items-end">
                  <span>
                    <TimeSince time={new Date(group.latestAt)} addSuffix />
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-primary">
                    Inspect
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </RouterLink>
            ))}
          </div>
          <div className="border-t border-border/70 p-2.5">
            <Button variant="outline" className="h-8 w-full text-sm" asChild>
              <RouterLink to="/explorer">Show All Failures</RouterLink>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-44 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <div className="rounded-full bg-status-success/10 p-3 text-status-success">
            <CheckCircle2 className="size-6" />
          </div>
          <h3 className="text-xl font-semibold">No recent failures</h3>
          <p className="max-w-lg text-sm text-muted-foreground">
            When tasks fail, this inbox will collect the latest task type and exception groups so you can jump straight
            into details.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-sm text-muted-foreground">
            <AlertTriangle className="size-4" />
            Healthy clusters keep this panel quiet.
          </div>
        </div>
      )}
    </Panel>
  )
}

export default FailureInbox
