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
import { useSelectedPath } from "../mvp/NodeRoute";
import { useTokenTree } from "../pages/use-groups";
import type { TokenNode } from "../tokens/groups";
import { hrefFor } from "./token-path";

type Crumb = { path: string; title: string };

function trail(tree: TokenNode[], path: string): Crumb[] {
    const crumbs: Crumb[] = [];
    let level = tree;
    let walked = "";

    for (const segment of path.split(".")) {
        walked = walked ? `${walked}.${segment}` : segment;
        const node = level.find((child) => child.name === segment);
        crumbs.push({ path: walked, title: node?.title ?? segment });
        level = node?.children ?? [];
    }

    return crumbs;
}

export function Breadcrumbs() {
    const path = useSelectedPath();
    const tree = useTokenTree();

    if (!path) return null;

    const crumbs = trail(tree, path);
    const current = crumbs.length - 1;

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {crumbs.map((crumb, index) => (
                    <Fragment key={crumb.path}>
                        {index > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem>
                            {index === current ? (
                                <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink asChild>
                                    <Link to={hrefFor(crumb.path)}>{crumb.title}</Link>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
