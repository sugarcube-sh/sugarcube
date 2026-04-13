import type { ConvertedToken } from "@sugarcube-sh/core";
import { useState } from "react";
import { NavLink } from "react-router";
import { useStudio } from "../context";
import { getTokenName } from "../lib/token-value";
import { countTokens } from "../lib/tree";
import type { TokenTreeNode } from "../types";

export function Sidebar() {
    const { status, tree } = useStudio();

    return (
        <nav className="sidebar">
            <div className="sidebar-header">
                <span className="sidebar-icon">&#9670;</span>
                <span className="sidebar-title">sugarcube studio</span>
                <span className={`sidebar-status sidebar-status--${status}`} />
            </div>

            <div className="sidebar-tree">
                {tree &&
                    Array.from(tree.roots.values()).map((node) => (
                        <TreeNode key={node.path} node={node} depth={0} />
                    ))}
            </div>
        </nav>
    );
}

function TreeNode({ node, depth }: { node: TokenTreeNode; depth: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = node.children.size > 0;
    const hasTokens = node.tokens.length > 0;
    // A node with one token named the same as itself is a lone leaf, not a group
    const isLoneLeaf =
        !hasChildren && node.tokens.length === 1 && node.tokens[0]?.$path === node.path;
    const isExpandable = !isLoneLeaf && (hasChildren || hasTokens);

    return (
        <div className="tree-node">
            <div className="tree-row" style={{ "--depth": depth } as React.CSSProperties}>
                {isExpandable ? (
                    <button
                        type="button"
                        className={`tree-chevron ${isOpen ? "tree-chevron--open" : ""}`}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        ›
                    </button>
                ) : (
                    <span className="tree-spacer" />
                )}
                <NavLink to={`/system/${node.path}`} className="tree-link">
                    <span className="tree-label">{node.name}</span>
                    <span className="tree-count">{countTokens(node)}</span>
                </NavLink>
            </div>

            {isOpen && (
                <div className="tree-children">
                    {/* Leaf tokens at this level */}
                    {node.tokens.map((token) => (
                        <TokenLeaf key={token.$path} token={token} depth={depth + 1} />
                    ))}
                    {/* Child groups */}
                    {Array.from(node.children.values()).map((child) => (
                        <TreeNode key={child.path} node={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}

function TokenLeaf({ token, depth }: { token: ConvertedToken; depth: number }) {
    return (
        <div className="tree-row" style={{ "--depth": depth } as React.CSSProperties}>
            <span className="tree-spacer" />
            <NavLink to={`/token/${token.$path}`} className="tree-link tree-link--leaf">
                <span className="tree-label">{getTokenName(token)}</span>
            </NavLink>
        </div>
    );
}
