"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type * as React from "react";

import cn from "clsx";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root className={cn("switch", className)} {...props}>
            <SwitchPrimitive.Thumb className={cn("switch-thumb")} />
        </SwitchPrimitive.Root>
    );
}

export { Switch };
