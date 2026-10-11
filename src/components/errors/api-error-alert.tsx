import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AlertCircle } from "lucide-react"
import React from "react"
import BadRequestAlert from "./bad-request-alert"
import NotFoundAlert from "./not-found-alert"
import ValidationErrorAlert from "./validation-error-alert"

interface ApiError {
  status: number
  body: unknown
}

interface ApiErrorAlertProps {
  error: ApiError
}

const ApiErrorAlert: React.FC<ApiErrorAlertProps> = (props) => {
  switch (props.error.status) {
    case 403:
      return (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>You don’t have access to this data or action. Contact your administrator.</AlertDescription>
        </Alert>
      )
    case 400:
      return <BadRequestAlert error={props.error.body as string} />
    case 404:
      return <NotFoundAlert error={props.error.body as string} />
    case 422:
      return (
        <ValidationErrorAlert
          error={props.error.body as { detail?: Array<{ loc: (string | number)[]; msg: string; type: string }> }}
        />
      )
    default:
      console.error(props.error)
      return (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Request failed ({props.error.status})</AlertTitle>
          <AlertDescription>Retry the request. If it keeps failing, check the server logs.</AlertDescription>
        </Alert>
      )
  }
}

export default ApiErrorAlert
