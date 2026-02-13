import { Alert, AlertTitle } from "@/registry/components/alert/react/alert";
import { CheckCircle2Icon } from "lucide-react";

export function AlertSizes() {
    return (
        <div className="flow w-full">
            <Alert data-size="sm" data-variant="success">
                <CheckCircle2Icon />
                <AlertTitle>Success! Your changes have been saved</AlertTitle>
            </Alert>
            <Alert data-size="md" data-variant="success">
                <CheckCircle2Icon />
                <AlertTitle>Success! Your changes have been saved</AlertTitle>
            </Alert>
            <Alert data-size="lg" data-variant="success">
                <CheckCircle2Icon />
                <AlertTitle>Success! Your changes have been saved</AlertTitle>
            </Alert>
        </div>
    );
}
