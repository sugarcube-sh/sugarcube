import type * as React from "react";

import cn from "clsx";

import { Input } from "./input";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="input-group"
            role="group"
            className={cn("input-group", className)}
            {...props}
        />
    );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
    return (
        <Input
            data-slot="input-group-control"
            className={cn("input-group-input", className)}
            {...props}
        />
    );
}

export { InputGroup, InputGroupInput };
