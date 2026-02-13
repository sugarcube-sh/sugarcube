"use client";

import cn from "clsx";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/registry/components/dialog/react/dialog";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
    return <CommandPrimitive data-slot="command" className={cn("command", className)} {...props} />;
}

function CommandDialog({
    title = "Command Palette",
    description = "Search for a command to run...",
    children,
    className,
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof Dialog> & {
    title?: string;
    description?: string;
    className?: string;
    showCloseButton?: boolean;
}) {
    return (
        <Dialog {...props}>
            <DialogTitle className="visually-hidden">{title}</DialogTitle>
            <DialogDescription className="visually-hidden">{description}</DialogDescription>
            <DialogContent className={cn(className)}>
                <Command className="">{children}</Command>
            </DialogContent>
        </Dialog>
    );
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div data-slot="command-input-wrapper" className="command-input-wrapper">
            <SearchIcon />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn("command-input", className)}
                {...props}
            />
        </div>
    );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            data-slot="command-list"
            className={cn("command-list", className)}
            {...props}
        />
    );
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty data-slot="command-empty" className="command-empty" {...props} />
    );
}

function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot="command-group"
            className={cn("command-group", className)}
            {...props}
        />
    );
}

function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot="command-separator"
            className={cn("command-separator", className)}
            {...props}
        />
    );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            data-slot="command-item"
            className={cn("command-item", className)}
            {...props}
        />
    );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="command-shortcut"
            className={cn("command-shortcut", className)}
            {...props}
        />
    );
}

export {
    Command,
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandShortcut,
    CommandSeparator,
};
