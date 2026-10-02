import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AlertCircle } from "lucide-react"
import React from "react"

interface NotFoundAlertProps {
  error: string
}

const NotFoundAlert: React.FC<NotFoundAlertProps> = (props) => {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Not found</AlertTitle>
      <AlertDescription>{props.error}</AlertDescription>
    </Alert>
  )
}

export default NotFoundAlert
