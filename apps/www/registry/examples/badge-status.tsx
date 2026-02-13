import { Badge } from "@/registry/components/badge/react/badge";
import { CheckCircle2Icon } from "lucide-react";

export function BadgeStatus() {
    return (
        <div className="cluster gap-2xs">
            <Badge data-variant="success">
                <CheckCircle2Icon />
                Active
            </Badge>
            <Badge data-variant="warning">Pending</Badge>
            <Badge data-variant="error">Inactive</Badge>
        </div>
    );
}
