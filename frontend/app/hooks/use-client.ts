import DemoClient from "@services/demo/demo-client"
import { ServerClient } from "@services/server/ServerClient"
import useSettingsStore from "@stores/use-settings-store"
import { useMemo } from "react"

export const useClient = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    return useMemo(() => (isDemo ? new DemoClient() : new ServerClient()), [isDemo])
}
