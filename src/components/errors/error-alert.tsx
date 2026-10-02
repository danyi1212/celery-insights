import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AlertCircle } from "lucide-react"
import React from "react"
import ApiErrorAlert from "./api-error-alert"

interface ErrorAlertProps {
  error: unknown
}

const ErrorAlert: React.FC<ErrorAlertProps> = (props) => {
  const err = props.error
  if (err && typeof err === "object" && "status" in err && "body" in err) {
    return <ApiErrorAlert error={err as { status: number; body: unknown }} />
  }
  console.error(props.error)
  const message = err instanceof Error ? err.message : "We have encountered an unknown error"
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export default ErrorAlert
