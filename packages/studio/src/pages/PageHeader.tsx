import type { ReactNode } from "react";

export function PageHeader({
    title,
    identity,
    description,
    children,
}: {
    title: ReactNode;
    identity?: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <header className="page-header flow">
            <div className="cluster cluster-gap-150">
                <h1 className="page-title">{title}</h1>
                {identity}
            </div>
            {typeof description === "string" ? (
                <p className="page-lede">{description}</p>
            ) : (
                description
            )}
            {children && <p className="page-meta text-quiet">{children}</p>}
        </header>
    );
}

export function PagePending({ children }: { children: ReactNode }) {
    return <p className="page-pending text-quiet">{children}</p>;
}
