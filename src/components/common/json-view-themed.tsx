import { useIsDark } from "@hooks/use-is-dark"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import { githubLightTheme } from "@uiw/react-json-view/githubLight"

type JsonViewThemedProps = Omit<React.ComponentProps<typeof JsonView>, "style"> & {
  style?: React.ComponentProps<typeof JsonView>["style"]
}

const JsonViewThemed = ({
  collapsed = 2,
  displayDataTypes = false,
  enableClipboard = false,
  style,
  ...props
}: JsonViewThemedProps) => {
  const isDark = useIsDark()

  return (
    <JsonView
      {...props}
      collapsed={collapsed}
      displayDataTypes={displayDataTypes}
      enableClipboard={enableClipboard}
      style={{
        ...(isDark ? githubDarkTheme : githubLightTheme),
        ...style,
      }}
    />
  )
}

export default JsonViewThemed
