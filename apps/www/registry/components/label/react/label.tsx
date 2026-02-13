"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";

import cn from "clsx";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
    return <LabelPrimitive.Root className={cn("label", className)} {...props} />;
}

export { Label };
