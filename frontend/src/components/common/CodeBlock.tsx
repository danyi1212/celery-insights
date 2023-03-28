import { useTheme } from "@mui/material"
import React from "react"
import { PrismLight as SyntaxHighlighter, SyntaxHighlighterProps } from "react-syntax-highlighter"
import darkStyle from "react-syntax-highlighter/dist/esm/styles/prism/material-dark"
import lightStyle from "react-syntax-highlighter/dist/esm/styles/prism/material-light"

interface CodeBlockProps extends Omit<SyntaxHighlighterProps, "children"> {
    code: string
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, ...props }) => {
    const theme = useTheme()
    return (
        <SyntaxHighlighter style={theme.palette.mode === "dark" ? darkStyle : lightStyle} {...props}>
            {code}
        </SyntaxHighlighter>
    )
}
export default CodeBlock
