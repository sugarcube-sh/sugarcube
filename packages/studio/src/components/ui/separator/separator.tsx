"use client";

import { Separator as SeparatorPrimitive } from "radix-ui";
import type * as React from "react";

import cn from "clsx";

function Separator({
    className,
    orientation = "horizontal",
    decorative = true,
    ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
    return (
        <SeparatorPrimitive.Root
            data-slot="separator"
            decorative={decorative}
            orientation={orientation}
            className={cn("separator", className)}
            {...props}
        />
    );
}

export { Separator };
