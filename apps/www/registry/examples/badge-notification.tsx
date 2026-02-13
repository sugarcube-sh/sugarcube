import { Badge } from "@/registry/components/badge/react/badge";
import { BellIcon, MailIcon, ShoppingCartIcon } from "lucide-react";
import type { CSSProperties } from "react";

export function BadgeNotification() {
    const badgeStyle: CSSProperties = {
        position: "absolute",
        top: "-4px",
        right: "-4px",
    };

    return (
        <div className="flow">
            <div className="cluster gap-2xs">
                <div style={{ position: "relative" } as CSSProperties}>
                    <BellIcon />
                    <Badge data-variant="error" data-size="xs" style={badgeStyle} />
                </div>
                <div style={{ position: "relative" } as CSSProperties}>
                    <MailIcon />
                    <Badge
                        data-variant="error"
                        data-size="sm"
                        style={badgeStyle}
                        className="tabular-nums"
                    >
                        3
                    </Badge>
                </div>
                <div style={{ position: "relative" } as CSSProperties}>
                    <ShoppingCartIcon />
                    <Badge
                        data-variant="error"
                        data-size="sm"
                        style={badgeStyle}
                        className="tabular-nums"
                    >
                        12
                    </Badge>
                </div>
            </div>
        </div>
    );
}
