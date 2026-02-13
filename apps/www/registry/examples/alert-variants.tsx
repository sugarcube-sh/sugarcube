import { Alert, AlertDescription, AlertTitle } from "@/registry/components/alert/react/alert";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";

export function AlertVariants() {
    return (
        <div className="flow w-full">
            <Alert>
                <CheckCircle2Icon />
                <AlertTitle>Default alert</AlertTitle>
                <AlertDescription>This is the alert style.</AlertDescription>
            </Alert>
            <Alert data-variant="success">
                <CheckCircle2Icon />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>Your changes have been saved.</AlertDescription>
            </Alert>
            <Alert data-variant="info">
                <InfoIcon />
                <AlertTitle>Information</AlertTitle>
                <AlertDescription>Here's some helpful information.</AlertDescription>
            </Alert>
            <Alert data-variant="warning">
                <AlertTriangleIcon />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>Please review this before proceeding.</AlertDescription>
            </Alert>
            <Alert data-variant="error">
                <AlertCircleIcon />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Something went wrong. Please try again.</AlertDescription>
            </Alert>
        </div>
    );
}
