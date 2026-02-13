import { Badge } from "@/registry/components/badge/react/badge";
import { BadgeCheckIcon } from "lucide-react";

export function BadgeWithIcon() {
    return (
        <div className="cluster gap-2xs">
            <Badge>
                <BadgeCheckIcon />
                Verified
            </Badge>
        </div>
    );
}
