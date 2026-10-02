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
          <AlertTitle>Failed to access server</AlertTitle>
          <AlertDescription>
            We are not able to contact the server, possibly due to:
            <ol className="list-decimal pl-4">
              <li>The server is not running</li>
              <li>Internal Server Error (500)</li>
              <li>Incorrect server URL or Port</li>
            </ol>
          </AlertDescription>
        </Alert>
      )
  }
}

export default ApiErrorAlert
