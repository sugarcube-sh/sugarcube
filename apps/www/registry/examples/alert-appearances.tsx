import { Alert, AlertDescription, AlertTitle } from "@/registry/components/alert/react/alert";
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";

export function AlertAppearances() {
    return (
        <div className="flow w-full">
            <Alert>
                <CheckCircle2Icon />
                <AlertTitle>Default</AlertTitle>
                <AlertDescription>This is the default alert appearance.</AlertDescription>
            </Alert>
            <Alert data-appearance="outlined">
                <CheckCircle2Icon />
                <AlertTitle>Outlined</AlertTitle>
                <AlertDescription>This alert has an outlined appearance.</AlertDescription>
            </Alert>
            <Alert data-appearance="soft" data-variant="success">
                <CheckCircle2Icon />
                <AlertTitle>Soft Success</AlertTitle>
                <AlertDescription>This alert has a soft appearance.</AlertDescription>
            </Alert>
            <Alert data-appearance="soft" data-variant="error">
                <AlertCircleIcon />
                <AlertTitle>Soft Error</AlertTitle>
                <AlertDescription>This is a soft error alert.</AlertDescription>
            </Alert>
            <Alert data-appearance="soft" data-variant="warning">
                <AlertCircleIcon />
                <AlertTitle>Soft Warning</AlertTitle>
                <AlertDescription>This is a soft warning alert.</AlertDescription>
            </Alert>
            <Alert data-appearance="soft" data-variant="info">
                <InfoIcon />
                <AlertTitle>Soft Info</AlertTitle>
                <AlertDescription>This is a soft info alert.</AlertDescription>
            </Alert>
        </div>
    );
}
