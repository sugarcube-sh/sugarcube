import { Slot } from "@radix-ui/react-slot";
import cn from "clsx";

function Badge({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<"span"> & { asChild?: boolean }) {
    const Comp = asChild ? Slot : "span";
    return <Comp data-slot="badge" className={cn("badge", className)} {...props} />;
}
export { Badge };
