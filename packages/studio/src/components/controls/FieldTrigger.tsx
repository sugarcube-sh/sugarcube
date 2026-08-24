"use client";

import cn from "clsx";
import { Icon } from "../ui/icon/Icons";

function FieldTrigger({ className, children, ...props }: React.ComponentProps<"button">) {
    return (
        <button
            type="button"
            data-slot="field-trigger"
            className={cn("field-trigger", className)}
            {...props}
        >
            {children}
        </button>
    );
}

function FieldTriggerContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="repel field-trigger-content">
            <div className="cluster cluster-gap-100">{children}</div>
            <Icon className="field-trigger-caret" name="caret-down" aria-hidden />
        </div>
    );
}

function FieldTriggerPlaceholder({ children }: { children: React.ReactNode }) {
    return <span className="field-trigger-placeholder">{children}</span>;
}

export { FieldTrigger, FieldTriggerContent, FieldTriggerPlaceholder };
