import { Badge } from "@/registry/components/badge/react/badge";

export function BadgeTags() {
    return (
        <div className="flow">
            <div className="cluster gap-2xs">
                <Badge>React</Badge>
                <Badge>TypeScript</Badge>
                <Badge>CSS</Badge>
                <Badge data-appearance="outlined">Design</Badge>
            </div>
            <div className="cluster gap-2xs">
                <Badge data-variant="success" data-appearance="soft">
                    Featured
                </Badge>
                <Badge data-variant="info" data-appearance="soft">
                    New
                </Badge>
                <Badge data-variant="warning" data-appearance="soft">
                    Popular
                </Badge>
            </div>
        </div>
    );
}
