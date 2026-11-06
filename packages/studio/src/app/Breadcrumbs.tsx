import { Fragment } from "react";
import { Link } from "react-router";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "../components/ui/breadcrumb/breadcrumb";
import { useSelectedPath } from "../canvas/NodeRoute";
import { trail } from "../controllers/views";
import { hrefFor } from "./token-path";

export function Breadcrumbs() {
    const path = useSelectedPath();
    if (path === undefined) return null;

    const crumbs = trail(path);
    const current = crumbs.length - 1;

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {crumbs.map((crumb, index) => (
                    <Fragment key={crumb.path}>
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                            {index === current ? (
                                <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink asChild>
                                    <Link to={hrefFor(crumb.path)}>{crumb.name}</Link>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
