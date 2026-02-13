import { Alert, AlertDescription, AlertTitle } from "@/registry/components/alert/react/alert";
import { CheckCircle2Icon } from "lucide-react";

export function AlertDemo() {
    return (
        <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Success! Your changes have been saved</AlertTitle>
            <AlertDescription>This is an alert with icon, title and description.</AlertDescription>
        </Alert>
    );
}
