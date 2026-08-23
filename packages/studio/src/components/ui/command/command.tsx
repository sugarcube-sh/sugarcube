"use client";

import cn from "clsx";
import { Command as CommandPrimitive } from "cmdk";
import { Icon } from "../icon/Icons";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
    return <CommandPrimitive data-slot="command" className={cn("command", className)} {...props} />;
}

function CommandSearchWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div data-slot="command-input-wrapper" className="command-input-wrapper">
            <Icon name="magnifying-glass" />
            {children}
        </div>
    );
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <CommandSearchWrapper>
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn("command-input", className)}
                {...props}
            />
        </CommandSearchWrapper>
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
            className={cn("command-item", "command-row", className)}
            {...props}
        />
    );
}

export {
    Command,
    CommandSearchWrapper,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
};
