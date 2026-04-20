"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import type * as React from "react";

import cn from "clsx";

function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
    return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
    className,
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
    return (
        <CollapsiblePrimitive.Trigger className={cn("collapsible-trigger", className)} {...props} />
    );
}

function CollapsibleContent({
    className,
    ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
    return (
        <CollapsiblePrimitive.Content className={cn("collapsible-content", className)} {...props} />
    );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
