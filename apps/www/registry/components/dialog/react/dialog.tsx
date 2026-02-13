"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import cn from "clsx";
import type * as React from "react";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return <DialogPrimitive.Trigger {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal {...props} />;
}

function DialogClose({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return <DialogPrimitive.Close className={cn("button", className)} {...props} />;
}

function DialogBackdrop({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return <DialogPrimitive.Overlay className={cn("dialog-backdrop", className)} {...props} />;
}

function DialogContent({
    className,
    children,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
    return (
        <DialogPortal>
            <DialogBackdrop />
            <DialogPrimitive.Content className={cn("dialog", className)} {...props}>
                {children}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return <DialogPrimitive.Title className={cn("dialog-title", className)} {...props} />;
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description className={cn("dialog-description", className)} {...props} />
    );
}

export {
    Dialog,
    DialogTrigger,
    DialogPortal,
    DialogBackdrop,
    DialogContent,
    DialogClose,
    DialogTitle,
    DialogDescription,
};
