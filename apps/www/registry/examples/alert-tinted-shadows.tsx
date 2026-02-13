import { Alert, AlertDescription, AlertTitle } from "@/registry/components/alert/react/alert";
import { CheckCircle2Icon } from "lucide-react";

export function AlertTintedShadows() {
    return (
        <div className="flow w-full">
            <Alert data-tinted-shadows>
                <CheckCircle2Icon />
                <AlertTitle>With tinted shadows</AlertTitle>
                <AlertDescription>
                    This alert uses tinted shadows that match the alert color.
                </AlertDescription>
            </Alert>
            <Alert data-tinted-shadows data-variant="success">
                <CheckCircle2Icon />
                <AlertTitle>Success with tinted shadows</AlertTitle>
                <AlertDescription>The shadow color matches the alert variant.</AlertDescription>
            </Alert>
        </div>
    );
}
