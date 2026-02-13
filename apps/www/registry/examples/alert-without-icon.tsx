import { Alert, AlertDescription, AlertTitle } from "@/registry/components/alert/react/alert";

export function AlertWithoutIcon() {
    return (
        <div className="flow w-full">
            <Alert>
                <AlertTitle>Default alert</AlertTitle>
                <AlertDescription>This alert has no icon.</AlertDescription>
            </Alert>
        </div>
    );
}
