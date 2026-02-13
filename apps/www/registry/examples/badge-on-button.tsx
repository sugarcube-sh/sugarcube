import { Badge } from "@/registry/components/badge/react/badge";
import { Button } from "@/registry/components/button/react/button";
import { ShoppingCartIcon } from "lucide-react";
import type { CSSProperties } from "react";

export function BadgeOnButton() {
    const badgeStyle: CSSProperties = {
        position: "absolute",
        top: "-4px",
        right: "-4px",
    };

    return (
        <div className="cluster gap-2xs">
            <Button style={{ position: "relative" } as CSSProperties}>
                Cart
                <Badge
                    data-variant="error"
                    data-size="xs"
                    style={badgeStyle}
                    className="tabular-nums"
                >
                    3
                </Badge>
            </Button>
            <Button style={{ position: "relative" } as CSSProperties}>
                <ShoppingCartIcon />
                <Badge
                    data-variant="error"
                    data-size="xs"
                    style={badgeStyle}
                    className="tabular-nums"
                >
                    5
                </Badge>
            </Button>
        </div>
    );
}
