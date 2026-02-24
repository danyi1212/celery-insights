import ShikiHighlighter from "react-shiki"
import React from "react"

interface CodeBlockProps {
    language?: string
    children?: string
    className?: string
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, language, className }) => {
    return (
        <ShikiHighlighter
            language={language || "text"}
            theme={{ light: "github-light", dark: "github-dark" }}
            defaultColor="light"
            showLanguage={false}
            className={className}
        >
            {children ?? ""}
        </ShikiHighlighter>
    )
}
export default CodeBlock
