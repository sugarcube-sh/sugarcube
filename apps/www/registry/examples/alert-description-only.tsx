import { Alert, AlertDescription } from "@/registry/components/alert/react/alert";
import { InfoIcon } from "lucide-react";

export function AlertDescriptionOnly() {
    return (
        <div className="flow w-full">
            <Alert>
                <InfoIcon />
                <AlertDescription>This alert has only a description, no title.</AlertDescription>
            </Alert>
            <Alert data-variant="warning">
                <AlertDescription>This is a warning without a title.</AlertDescription>
            </Alert>
        </div>
    );
}
