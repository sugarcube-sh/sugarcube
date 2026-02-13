import type * as React from "react";

import cn from "clsx";

function Card({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card", className)} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card-header", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card-title", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card-description", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card-action", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card-content", className)} {...props} />;
}

function CardMedia({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card-media", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("card-footer", className)} {...props} />;
}

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardAction,
    CardDescription,
    CardContent,
    CardMedia,
};
