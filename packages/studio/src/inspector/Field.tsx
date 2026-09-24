"use client";

import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "../components/ui/collapsible/collapsible";
import cn from "clsx";
import { createContext, useContext, useId, useMemo } from "react";
import { Icon } from "../components/ui/icon/Icons";

function FieldSection({ className, ...props }: React.ComponentProps<typeof Collapsible>) {
    return (
        <Collapsible
            data-slot="field-content"
            className={cn("field-content", className)}
            {...props}
        />
    );
}

function FieldHeader({
    className,
    children,
    ...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
    return (
        <CollapsibleTrigger className={cn("field-header", className)} {...props}>
            {children}
            <Icon name="caret-down" className="field-caret" aria-hidden />
        </CollapsibleTrigger>
    );
}

function FieldIndex({ className, ...props }: React.ComponentProps<"span">) {
    return <span className={cn("field-index", className)} {...props} />;
}

function FieldTitle({ className, ...props }: React.ComponentProps<"span">) {
    return <span className={cn("field-title", className)} {...props} />;
}

function FieldGroup({ className, ...props }: React.ComponentProps<typeof CollapsibleContent>) {
    return <CollapsibleContent className={cn("field-group", className)} {...props} />;
}

const FieldRowContext = createContext<{ id: string; labelId: string } | null>(null);

function FieldRow({
    className,
    layout = "split",
    ...props
}: React.ComponentProps<"div"> & { layout?: "split" | "full" }) {
    const id = useId();
    const row = useMemo(() => ({ id, labelId: `${id}-label` }), [id]);
    return (
        <FieldRowContext.Provider value={row}>
            <div
                data-slot="field-row"
                data-layout={layout}
                className={cn("field-row", className)}
                {...props}
            />
        </FieldRowContext.Provider>
    );
}

function useFieldRow() {
    return useContext(FieldRowContext);
}

function FieldLabelCell({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="field-label-cell"
            className={cn("field-label-cell", className)}
            {...props}
        />
    );
}

function FieldLabel({ className, htmlFor, id, ...props }: React.ComponentProps<"label">) {
    const row = useFieldRow();
    return (
        <label
            id={id ?? row?.labelId}
            htmlFor={htmlFor ?? row?.id}
            className={cn("field-label", className)}
            {...props}
        />
    );
}

function FieldValue({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="field-value" className={cn("field-value", className)} {...props} />;
}

function FieldReset({
    className,
    "aria-label": ariaLabel,
    ...props
}: React.ComponentProps<"button">) {
    return (
        <button
            type="button"
            data-slot="field-reset"
            aria-label={ariaLabel ?? "Reset to default"}
            className={cn("field-reset", className)}
            {...props}
        >
            <Icon name="reset" className="field-reset-icon" aria-hidden />
        </button>
    );
}

export {
    FieldSection,
    FieldHeader,
    FieldIndex,
    FieldTitle,
    FieldGroup,
    FieldRow,
    useFieldRow,
    FieldLabelCell,
    FieldLabel,
    FieldValue,
    FieldReset,
};
