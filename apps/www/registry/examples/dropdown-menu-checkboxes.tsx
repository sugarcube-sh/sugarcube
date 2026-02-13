import * as React from "react";

import { Button } from "@/registry/components/button/react/button.tsx";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/registry/components/dropdown-menu/react/dropdown-menu.tsx";

export default function DropdownMenuCheckboxes() {
    const [showStatusBar, setShowStatusBar] = React.useState<boolean>(true);
    const [showActivityBar, setShowActivityBar] = React.useState<boolean>(false);
    const [showPanel, setShowPanel] = React.useState<boolean>(false);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button data-variant="outline">Open</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                    checked={showStatusBar}
                    onCheckedChange={setShowStatusBar}
                >
                    Status Bar
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                    checked={showActivityBar}
                    onCheckedChange={setShowActivityBar}
                    disabled
                >
                    Activity Bar
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={showPanel} onCheckedChange={setShowPanel}>
                    Panel
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
