import Panel from "@components/common/panel"
import { LimitSelect } from "@components/raw_events/limit-select"
import ThemeSelector from "@components/settings/theme-selector"
import { Button } from "@components/ui/button"
import { Switch } from "@components/ui/switch"
import useSettingsStore, { resetSettings, useIsDefaultSettings } from "@stores/use-settings-store"
import { startTour } from "@stores/use-tour-store"

const SettingRow = ({
    title,
    description,
    control,
    helper,
}: {
    title: string
    description: string
    control: React.ReactNode
    helper?: string
}) => (
    <div className="flex flex-col gap-3 rounded-2xl border bg-background/60 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
        </div>
        <div className="flex shrink-0 items-center">{control}</div>
    </div>
)

const SettingsPanel = ({ hideHeader = false }: { hideHeader?: boolean }) => {
    const hideWelcomeBanner = useSettingsStore((state) => state.hideWelcomeBanner)
    const isDemo = useSettingsStore((state) => state.demo)
    const rawEventsLimit = useSettingsStore((state) => state.rawEventsLimit)

    return (
        <Panel title="Workspace" hideHeader={hideHeader}>
            <div className="space-y-4 p-4">
                <p className="max-w-3xl text-sm text-muted-foreground">
                    These settings stay in this browser. They do not change the running server.
                </p>
                <SettingRow
                    title="Theme"
                    description="Choose light, dark, or match your system."
                    control={<ThemeSelector />}
                />
                <SettingRow
                    title="Welcome banner"
                    description="Show the getting-started banner on the home page."
                    helper={hideWelcomeBanner ? "Currently hidden" : "Currently visible"}
                    control={
                        <Switch
                            aria-label="Show welcome banner"
                            checked={!hideWelcomeBanner}
                            onCheckedChange={(checked) => useSettingsStore.setState({ hideWelcomeBanner: !checked })}
                        />
                    }
                />
                <SettingRow
                    title="Demo mode"
                    description="Use sample data instead of the live backend."
                    helper={isDemo ? "Currently using sample data." : "Currently using the live backend."}
                    control={
                        <Switch
                            aria-label="Demo mode"
                            checked={isDemo}
                            disabled={Boolean(import.meta.env.VITE_DEMO_MODE)}
                            onCheckedChange={(checked) => useSettingsStore.setState({ demo: checked })}
                        />
                    }
                />
                <SettingRow
                    title="Live events limit"
                    description="Choose how many events the Live Events page shows at once."
                    helper={`Currently set to ${rawEventsLimit.toLocaleString()} events`}
                    control={
                        <LimitSelect
                            limit={rawEventsLimit}
                            setLimit={(limit) => useSettingsStore.setState({ rawEventsLimit: limit })}
                        />
                    }
                />
                <SettingRow
                    title="Product tour"
                    description="Start the guided walkthrough again."
                    control={
                        <Button variant="outline" size="sm" onClick={() => startTour()}>
                            Start tour
                        </Button>
                    }
                />
            </div>
        </Panel>
    )
}

export const SettingsPanelAction = () => {
    const isDefaultSettings = useIsDefaultSettings()

    return (
        <Button variant="outline" onClick={() => resetSettings()} disabled={isDefaultSettings}>
            Reset local settings
        </Button>
    )
}

export default SettingsPanel
