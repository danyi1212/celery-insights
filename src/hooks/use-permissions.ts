import useSettingsStore from "@stores/use-settings-store"
import { useIdentity } from "./use-identity"

/** UI hints use role grants; every action remains subject to current server policy. */
export function usePermissions() {
  const isDemo = useSettingsStore((state) => state.demo)
  const identity = useIdentity()
  return {
    can: (...permissions: string[]) =>
      isDemo || permissions.every((permission) => identity.data?.permissions?.includes(permission) === true),
    isLoading: !isDemo && identity.isPending,
  }
}
