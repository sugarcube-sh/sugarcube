"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import cn from "clsx";
import type * as React from "react";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return <TabsPrimitive.Root data-slot="tabs" className={cn("tabs", className)} {...props} />;
}
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn("tabs-list", className)}
            {...props}
        />
    );
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn("tabs-trigger", className)}
            {...props}
        />
    );
}
function TabsPanel({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="tabs-content"
            className={cn("tabs-panel", className)}
            {...props}
        />
    );
}
export { Tabs, TabsList, TabsTrigger, TabsPanel };
