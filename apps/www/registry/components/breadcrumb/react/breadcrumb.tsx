import { Slot } from "@radix-ui/react-slot";
import cn from "clsx";
import { ChevronRight, MoreHorizontal } from "lucide-react";

function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
    return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
    return (
        <ol data-slot="breadcrumb-list" className={cn("breadcrumb-list", className)} {...props} />
    );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
    return (
        <li data-slot="breadcrumb-item" className={cn("breadcrumb-item", className)} {...props} />
    );
}

function BreadcrumbLink({
    asChild,
    className,
    ...props
}: React.ComponentProps<"a"> & {
    asChild?: boolean;
}) {
    const Comp = asChild ? Slot : "a";

    return (
        <Comp data-slot="breadcrumb-link" className={cn("breadcrumb-link", className)} {...props} />
    );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="breadcrumb-page"
            aria-disabled="true"
            aria-current="page"
            className={cn("breadcrumb-page", className)}
            {...props}
        />
    );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="breadcrumb-separator"
            role="presentation"
            aria-hidden="true"
            className={cn("breadcrumb-separator", className)}
            {...props}
        >
            {children ?? <ChevronRight />}
        </li>
    );
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="breadcrumb-ellipsis"
            role="presentation"
            aria-hidden="true"
            className={cn("breadcrumb-ellipsis", className)}
            {...props}
        >
            <MoreHorizontal />
            <span className="visually-hidden">More</span>
        </span>
    );
}

export {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    BreadcrumbEllipsis,
};
