import CodeBlock from "@components/common/CodeBlock"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import Alert, { AlertProps } from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import React, { useState } from "react"

interface ExceptionTracebackProps extends AlertProps {
    exception?: string
    traceback?: string
}

const ExceptionTraceback: React.FC<ExceptionTracebackProps> = ({ exception, traceback, ...props }) => {
    const [expanded, setExpanded] = useState(false)

    if (!exception) return null

    return (
        <Alert severity="error" {...props}>
            <AlertTitle>Exception</AlertTitle>
            <Typography variant="body2" py={1}>
                {exception}
            </Typography>
            <Button
                color="inherit"
                disabled={!traceback}
                onClick={() => setExpanded((expended) => !expended)}
                startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
                Traceback
            </Button>
            {expanded && traceback && <CodeBlock language="python" code={traceback} />}
        </Alert>
    )
}

export default ExceptionTraceback
