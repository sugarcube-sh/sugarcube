import { useMemo, useState } from "react";
import { Link, NavLink, useLocation, useMatch } from "react-router";
import { getAncestorPaths, toHref } from "../app/token-path";
import { Logo } from "../app/Logo";
import { getLogin } from "../controllers/sign-in";
import { useSignIn } from "../providers/sign-in-context";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible/collapsible";
import { Icon } from "./ui/icon/Icons";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
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
import { type TreeNode, getSidebarTree } from "../controllers/views";
import { useStudioState } from "../providers/studio-context";

function useIsNodeActive(path: string) {
    return !!useMatch({ path: toHref(path), end: true });
}

function TreeLinkButton({ node }: { node: TreeNode }) {
    const isActive = useIsNodeActive(node.path);

    return (
        <SidebarMenuButton asChild isActive={isActive} tooltip={node.name}>
            <NavLink to={toHref(node.path)} end>
                <span>{node.name}</span>
            </NavLink>
        </SidebarMenuButton>
    );
}

function TreeSubLinkButton({ node }: { node: TreeNode }) {
    const isActive = useIsNodeActive(node.path);

    return (
        <SidebarMenuSubButton asChild isActive={isActive}>
            <NavLink to={toHref(node.path)} end>
                <span>{node.name}</span>
            </NavLink>
        </SidebarMenuSubButton>
    );
}

function TreeBranchRow({ node, nested }: { node: TreeNode; nested?: boolean }) {
    const isActive = useIsNodeActive(node.path);

    return (
        <CollapsibleTrigger asChild>
            <NavLink
                to={toHref(node.path)}
                end
                className={
                    nested ? "sidebar-branch-row sidebar-branch-row-sub" : "sidebar-branch-row"
                }
                data-active={isActive || undefined}
            >
                <span className="sidebar-branch-title">{node.name}</span>
                <span className="sidebar-branch-meta">
                    <Icon name="caret-right" size="sm" className="sidebar-menu-chevron" />
                </span>
            </NavLink>
        </CollapsibleTrigger>
    );
}

type TreeItemProps = {
    node: TreeNode;
    openPaths: ReadonlySet<string>;
    onToggle: (path: string) => void;
    nested?: boolean;
};

function TreeLeafItem({ node, nested }: { node: TreeNode; nested?: boolean }) {
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

function TreeBranchItem({ node, openPaths, onToggle, nested }: TreeItemProps) {
    const expanded = openPaths.has(node.path);
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
                                openPaths={openPaths}
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

function TreeItem({ node, openPaths, onToggle, nested }: TreeItemProps) {
    if (node.children.length === 0) {
        return <TreeLeafItem node={node} nested={nested} />;
    }

    return <TreeBranchItem node={node} openPaths={openPaths} onToggle={onToggle} nested={nested} />;
}

export function AppSidebar() {
    const tokens = useStudioState((state) => state.tokens);
    const tree = useMemo(() => getSidebarTree(tokens), [tokens]);
    const { pathname } = useLocation();
    const [openPaths, setOpenPaths] = useState<ReadonlySet<string>>(new Set());
    const [lastPathname, setLastPathname] = useState<string | null>(null);

    if (pathname !== lastPathname) {
        setLastPathname(pathname);
        const ancestors = getAncestorPaths(pathname);
        if (!ancestors.every((path) => openPaths.has(path)))
            setOpenPaths(new Set([...openPaths, ...ancestors]));
    }

    function toggle(path: string) {
        setOpenPaths((current) => {
            const next = new Set(current);
            if (!next.delete(path)) next.add(path);
            return next;
        });
    }

    return (
        <Sidebar variant="inset" collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg">
                            <Link to="/" aria-label="Sugarcube">
                                <Logo />
                                <span>Sugarcube</span>
                            </Link>
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
                                    openPaths={openPaths}
                                    onToggle={toggle}
                                />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <Person />
        </Sidebar>
    );
}

function Person() {
    const signIn = useSignIn();
    const person = getLogin(signIn);
    if (!signIn || person === undefined) return null;
    return (
        <SidebarFooter>
            <div className="repel">
                <span>{person}</span>
                <button type="button" className="button" onClick={() => void signIn.signOut()}>
                    Sign out
                </button>
            </div>
        </SidebarFooter>
    );
}
