import { AlertCircleIcon, CheckIcon } from "lucide-react";

import { Badge } from "@/registry/components/badge/react/badge";

export function BadgeDemo() {
    return (
        <div className="flow">
            <div className="cluster">
                <Badge>Default</Badge>
                <Badge data-variant="accent">Accent</Badge>
                <Badge data-variant="neutral">Neutral</Badge>
                <Badge data-variant="error">Error</Badge>
                <Badge data-variant="info">Info</Badge>
                <Badge data-variant="success">Success</Badge>
                <Badge data-variant="warning">Warning</Badge>
                <Badge>
                    <CheckIcon />
                    Badge
                </Badge>
                <Badge data-variant="error">
                    <AlertCircleIcon />
                    Alert
                </Badge>
                <Badge>8</Badge>
                <Badge data-variant="accent">99</Badge>
                <Badge>20+</Badge>
            </div>
            <div className="cluster">
                <Badge data-appearance="soft">Soft Default</Badge>
                <Badge data-appearance="soft" data-variant="accent">
                    Soft Accent
                </Badge>
                <Badge data-appearance="soft" data-variant="neutral">
                    Soft Neutral
                </Badge>
                <Badge data-appearance="soft" data-variant="error">
                    Soft Error
                </Badge>
                <Badge data-appearance="soft" data-variant="info">
                    Soft Info
                </Badge>
                <Badge data-appearance="soft" data-variant="success">
                    Soft Success
                </Badge>
                <Badge data-appearance="soft" data-variant="warning">
                    Soft Warning
                </Badge>
                <Badge data-appearance="soft">
                    <CheckIcon />
                    Badge
                </Badge>
                <Badge data-appearance="soft" data-variant="error">
                    <AlertCircleIcon />
                    Alert
                </Badge>
                <Badge data-appearance="soft">8</Badge>
                <Badge data-appearance="soft" data-variant="accent">
                    99
                </Badge>
                <Badge data-appearance="soft">20+</Badge>
            </div>
            <div className="cluster">
                <Badge data-appearance="outlined">Outline Default</Badge>
                <Badge data-appearance="outlined" data-variant="accent">
                    Outline Accent
                </Badge>
                <Badge data-appearance="outlined" data-variant="neutral">
                    Outline Neutral
                </Badge>
                <Badge data-appearance="outlined" data-variant="error">
                    Outline Error
                </Badge>
                <Badge data-appearance="outlined" data-variant="info">
                    Outline Info
                </Badge>
                <Badge data-appearance="outlined" data-variant="success">
                    Outline Success
                </Badge>
                <Badge data-appearance="outlined" data-variant="warning">
                    Outline Warning
                </Badge>
                <Badge data-appearance="outlined">
                    <CheckIcon />
                    Badge
                </Badge>
                <Badge data-appearance="outlined" data-variant="error">
                    <AlertCircleIcon />
                    Alert
                </Badge>
                <Badge data-appearance="outlined">8</Badge>
                <Badge data-appearance="outlined" data-variant="accent">
                    99
                </Badge>
                <Badge data-appearance="outlined">20+</Badge>
            </div>
            <div className="cluster">
                <Badge data-size="lg">Large</Badge>
            </div>
        </div>
    );
}
