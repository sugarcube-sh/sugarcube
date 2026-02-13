"use client";

import * as Ariakit from "@ariakit/react";
import cn from "clsx";
import type * as React from "react";

function Dialog({ className, ...props }: React.ComponentProps<typeof Ariakit.Dialog>) {
    return <Ariakit.Dialog className={cn("dialog", className)} {...props} />;
}

function DialogTrigger({
    className,
    ...props
}: React.ComponentProps<typeof Ariakit.DialogDisclosure>) {
    return <Ariakit.DialogDisclosure className={cn("button", className)} {...props} />;
}

function DialogClose({ className, ...props }: React.ComponentProps<typeof Ariakit.DialogDismiss>) {
    return <Ariakit.DialogDismiss className={cn("button", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof Ariakit.DialogHeading>) {
    return <Ariakit.DialogHeading className={cn("dialog-title", className)} {...props} />;
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof Ariakit.DialogDescription>) {
    return <Ariakit.DialogDescription className={cn("dialog-description", className)} {...props} />;
}

function DialogProvider({
    children,
    ...props
}: React.ComponentProps<typeof Ariakit.DialogProvider> & { children: React.ReactNode }) {
    return <Ariakit.DialogProvider {...props}>{children}</Ariakit.DialogProvider>;
}

export { Dialog, DialogTrigger, DialogClose, DialogTitle, DialogDescription, DialogProvider };
