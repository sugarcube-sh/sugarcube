import { Badge } from "@/registry/components/badge/react/badge";

export function BadgeVariants() {
    return (
        <div className="cluster gap-2xs">
            <Badge>Default</Badge>
            <Badge data-variant="accent">Accent</Badge>
            <Badge data-variant="neutral">Neutral</Badge>
            <Badge data-variant="error">Error</Badge>
            <Badge data-variant="info">Info</Badge>
            <Badge data-variant="success">Success</Badge>
            <Badge data-variant="warning">Warning</Badge>
        </div>
    );
}
