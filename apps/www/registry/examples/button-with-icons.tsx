import { ArrowRightIcon, SendIcon } from "lucide-react";

import { Button } from "@/registry/components/button/react/button";

export function ButtonWithIcons() {
    return (
        <div className="cluster gutter-2xs">
            <Button>
                <SendIcon /> Send
            </Button>
            <Button>
                Learn More <ArrowRightIcon />
            </Button>
        </div>
    );
}
