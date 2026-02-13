import { Alert, AlertDescription, AlertTitle } from "@/registry/components/alert/react/alert";
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";

export function AlertBorderAccent() {
    return (
        <div className="flow w-full">
            <Alert data-border-accent>
                <AlertTitle>Default with border accent</AlertTitle>
                <AlertDescription>
                    This alert has a thick colored border on the left side.
                </AlertDescription>
            </Alert>
            <Alert data-variant="success" data-border-accent>
                <CheckCircle2Icon />
                <AlertTitle>Success with border accent</AlertTitle>
                <AlertDescription>The border color matches the variant.</AlertDescription>
            </Alert>
            <Alert data-variant="info" data-border-accent>
                <InfoIcon />
                <AlertTitle>Info with border accent</AlertTitle>
                <AlertDescription>
                    This style is commonly used for important alerts.
                </AlertDescription>
            </Alert>
            <Alert data-variant="warning" data-border-accent>
                <AlertTriangleIcon />
                <AlertTitle>Warning with border accent</AlertTitle>
                <AlertDescription>Notice the thick colored border on the left.</AlertDescription>
            </Alert>
            <Alert data-variant="error" data-border-accent>
                <AlertCircleIcon />
                <AlertTitle>Error with border accent</AlertTitle>
                <AlertDescription>The border provides a strong visual indicator.</AlertDescription>
            </Alert>
        </div>
    );
}
