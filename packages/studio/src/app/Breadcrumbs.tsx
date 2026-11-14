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
import { getBreadcrumbs } from "../controllers/views";
import { toHref } from "./token-path";

export function Breadcrumbs() {
    const path = useSelectedPath();
    if (path === undefined) return null;

    const crumbs = getBreadcrumbs(path);
    const lastIndex = crumbs.length - 1;

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {crumbs.map((crumb, index) => (
                    <Fragment key={crumb.path}>
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                            {index === lastIndex ? (
                                <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink asChild>
                                    <Link to={toHref(crumb.path)}>{crumb.name}</Link>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
