import DemoClient from "@services/demo/DemoClient"
import { ServerClient } from "@services/server/ServerClient"
import useSettingsStore from "@stores/useSettingsStore"
import { useMemo } from "react"

export const useClient = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    return useMemo(() => (isDemo ? new DemoClient() : new ServerClient()), [isDemo])
}
