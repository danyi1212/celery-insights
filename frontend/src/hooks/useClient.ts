import DemoClient from "@services/demo/DemoClient"
import { ServerClient } from "@services/server/ServerClient"
import useSettingsStore from "@stores/useSettingsStore"

export const useClient = () => {
    const isDemo = useSettingsStore((state) => state.demo)
    return isDemo ? new DemoClient() : new ServerClient()
}
