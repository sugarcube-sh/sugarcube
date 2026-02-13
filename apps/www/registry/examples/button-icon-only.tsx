import { ArrowRightIcon, SendIcon } from "lucide-react";

import { Button } from "@/registry/components/button/react/button";

export function ButtonIconOnly() {
    return (
        <div className="cluster gutter-2xs">
            <Button className="is-icon-only">
                <SendIcon />
            </Button>
            <Button data-appearance="outlined" className="is-icon-only">
                <ArrowRightIcon />
            </Button>
            <Button data-appearance="soft" className="is-icon-only">
                <ArrowRightIcon />
            </Button>
            <Button data-appearance="soft-outlined" className="is-icon-only">
                <ArrowRightIcon />
            </Button>
            <Button data-appearance="ghost" className="is-icon-only">
                <ArrowRightIcon />
            </Button>
        </div>
    );
}
