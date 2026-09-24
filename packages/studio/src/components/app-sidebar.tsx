import { useState } from "react";
import { NavLink, useLocation, useMatch } from "react-router";
import { ancestorsOf, hrefFor } from "../app/token-path";
import { Logo } from "../app/Logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible/collapsible";
import { Icon } from "./ui/icon/Icons";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "./ui/sidebar/sidebar";
import { useTokenTree } from "../pages/use-groups";
import { type TokenNode, isLeaf } from "../tokens/groups";

function useNodeActive(path: string) {
    return !!useMatch({ path: hrefFor(path), end: true });
}

function TreeLinkButton({ node }: { node: TokenNode }) {
    const isActive = useNodeActive(node.path);

    return (
        <SidebarMenuButton asChild isActive={isActive} tooltip={node.title}>
            <NavLink to={hrefFor(node.path)} end>
                <span>{node.title}</span>
            </NavLink>
        </SidebarMenuButton>
    );
}

function TreeSubLinkButton({ node }: { node: TokenNode }) {
    const isActive = useNodeActive(node.path);

    return (
        <SidebarMenuSubButton asChild isActive={isActive}>
            <NavLink to={hrefFor(node.path)} end>
                <span>{node.title}</span>
            </NavLink>
        </SidebarMenuSubButton>
    );
}

function TreeBranchRow({ node, nested }: { node: TokenNode; nested?: boolean }) {
    const isActive = useNodeActive(node.path);

    return (
        <CollapsibleTrigger asChild>
            <NavLink
                to={hrefFor(node.path)}
                end
                className={
                    nested ? "sidebar-branch-row sidebar-branch-row-sub" : "sidebar-branch-row"
                }
                data-active={isActive || undefined}
            >
                <span className="sidebar-branch-title">{node.title}</span>
                <span className="sidebar-branch-meta">
                    <Icon name="caret-right" size="sm" className="sidebar-menu-chevron" />
                </span>
            </NavLink>
        </CollapsibleTrigger>
    );
}

type TreeItemProps = {
    node: TokenNode;
    open: ReadonlySet<string>;
    onToggle: (path: string) => void;
    nested?: boolean;
};

function TreeLeafItem({ node, nested }: { node: TokenNode; nested?: boolean }) {
    if (nested) {
        return (
            <SidebarMenuSubItem>
                <TreeSubLinkButton node={node} />
            </SidebarMenuSubItem>
        );
    }

    return (
        <SidebarMenuItem>
            <TreeLinkButton node={node} />
        </SidebarMenuItem>
    );
}

function TreeBranchItem({ node, open, onToggle, nested }: TreeItemProps) {
    const expanded = open.has(node.path);
    const MenuItem = nested ? SidebarMenuSubItem : SidebarMenuItem;

    return (
        <Collapsible asChild open={expanded} onOpenChange={() => onToggle(node.path)}>
            <MenuItem>
                <TreeBranchRow node={node} nested={nested} />
                <CollapsibleContent asChild>
                    <SidebarMenuSub>
                        {node.children.map((child) => (
                            <TreeItem
                                key={child.path}
                                node={child}
                                open={open}
                                onToggle={onToggle}
                                nested
                            />
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </MenuItem>
        </Collapsible>
    );
}

function TreeItem({ node, open, onToggle, nested }: TreeItemProps) {
    if (isLeaf(node)) {
        return <TreeLeafItem node={node} nested={nested} />;
    }

    return <TreeBranchItem node={node} open={open} onToggle={onToggle} nested={nested} />;
}

export function AppSidebar() {
    const tree = useTokenTree();
    const { pathname } = useLocation();
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
    const [seen, setSeen] = useState<string | null>(null);

    // Arriving somewhere opens the branches above it, once per arrival.
    if (pathname !== seen) {
        setSeen(pathname);
        const ancestors = ancestorsOf(pathname);
        if (!ancestors.every((path) => open.has(path))) setOpen(new Set([...open, ...ancestors]));
    }

    function toggle(path: string) {
        setOpen((current) => {
            const next = new Set(current);
            if (!next.delete(path)) next.add(path);
            return next;
        });
    }

    const home = tree[0]?.name ?? "";

    return (
        <Sidebar variant="inset" collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg">
                            <NavLink to={`/${home}`} aria-label="Sugarcube">
                                <Logo />
                                <span>Sugarcube</span>
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Tokens</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu aria-label="Token document">
                            {tree.map((node) => (
                                <TreeItem
                                    key={node.path}
                                    node={node}
                                    open={open}
                                    onToggle={toggle}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
