import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { CheckCircle2, Copy, XCircle } from "lucide-react"
import ShikiHighlighter from "react-shiki"
import React, { useMemo, useState } from "react"

interface CodeBlockProps {
    language?: string
    children?: string
    className?: string
}

enum CopyStatus {
    Default,
    Copied,
    Error,
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, language, className }) => {
    const [copyStatus, setCopyStatus] = useState<CopyStatus>(CopyStatus.Default)
    const value = children ?? ""

    const copyIcon = useMemo(() => {
        switch (copyStatus) {
            case CopyStatus.Copied:
                return {
                    icon: <CheckCircle2 className="size-4 text-status-success" />,
                    tooltip: "Copied!",
                }
            case CopyStatus.Error:
                return {
                    icon: <XCircle className="size-4 text-status-danger" />,
                    tooltip: "Error: could not copy",
                }
            default:
                return {
                    icon: <Copy className="size-4 text-muted-foreground" />,
                    tooltip: "Copy code",
                }
        }
    }, [copyStatus])

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value)
            setCopyStatus(CopyStatus.Copied)
        } catch (error) {
            console.error("Failed to copy code:", error)
            setCopyStatus(CopyStatus.Error)
        }

        setTimeout(() => {
            setCopyStatus(CopyStatus.Default)
        }, 3000)
    }

    return (
        <div className="relative">
            <div className="absolute right-2 top-2 z-10">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon-xs" onClick={handleCopy} aria-label="Copy code">
                            {copyIcon.icon}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copyIcon.tooltip}</TooltipContent>
                </Tooltip>
            </div>
            <ShikiHighlighter
                language={language || "text"}
                theme={{ light: "github-light", dark: "github-dark" }}
                defaultColor="light"
                showLanguage={false}
                className={className}
            >
                {value}
            </ShikiHighlighter>
        </div>
    )
}
export default CodeBlock
