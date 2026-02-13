import cn from "clsx";

function Alert({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="alert" role="alert" className={cn("alert", className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="alert-title" className={cn("alert-title", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-description"
            className={cn("alert-description", className)}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription };
