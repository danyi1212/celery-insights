import { useTheme } from "@mui/material"
import React from "react"
import { PrismLight as SyntaxHighlighter, SyntaxHighlighterProps } from "react-syntax-highlighter"
import darkStyle from "react-syntax-highlighter/dist/esm/styles/prism/material-dark"
import lightStyle from "react-syntax-highlighter/dist/esm/styles/prism/material-light"

const CodeBlock: React.FC<SyntaxHighlighterProps> = ({ children, ...props }) => {
    const theme = useTheme()
    return (
        <SyntaxHighlighter style={theme.palette.mode === "dark" ? darkStyle : lightStyle} {...props}>
            {children}
        </SyntaxHighlighter>
    )
}
export default CodeBlock
