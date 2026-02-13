import type * as React from "react";

import cn from "clsx";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
    return <textarea className={cn("textarea", className)} {...props} />;
}

export { Textarea };
