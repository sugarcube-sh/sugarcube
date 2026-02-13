import { Badge } from "@/registry/components/badge/react/badge";

export function BadgeNumbers() {
    return (
        <div className="cluster gap-2xs">
            <Badge className="tabular-nums">8</Badge>
            <Badge data-variant="error" className="tabular-nums">
                99
            </Badge>
            <Badge data-appearance="outlined" className="tabular-nums">
                20+
            </Badge>
            <Badge data-variant="success" className="tabular-nums">
                1
            </Badge>
        </div>
    );
}
