import type {
    Change,
    DesignTokens,
    Group,
    Permutation,
    Permutations,
    Token,
    TokenType,
} from "@sugarcube-sh/dtcg";
import type { TypographyCSS } from "@sugarcube-sh/dtcg/css";
import { UserFacingError } from "../error-messages";
import type { BuildOutput, BuildProblem, ExtensionForm } from "./adapter";
import type { StudioState } from "./studio";
import {
    type DeprecationView,
    type DescriptionView,
    getDeprecationView,
    getDescriptionView,
} from "./properties";

export interface TreeNode {
    readonly path: string;
    readonly name: string;
    readonly count: number;
    readonly children: readonly TreeNode[];
    readonly hasValue?: true;
}

export interface Crumb {
    readonly path: string;
    readonly name: string;
}

export interface GroupRow {
    readonly path: string;
    readonly name: string;
    readonly count: number;
}

export interface TokenRow {
    readonly path: string;
    readonly name: string;
    readonly type: TokenType;
    readonly originalValue: unknown;
    readonly css: string | TypographyCSS | undefined;
}

export interface ProblemRow {
    readonly location?: string;
    readonly severity: BuildProblem["severity"];
    readonly message: string;
    readonly permutationLabel?: string;
    readonly kind: string;
    readonly paths?: readonly string[];
}

export interface ChangeLine {
    readonly kind: Change["kind"];
    readonly path: string;
    readonly topLevel?: true;
    readonly from?: string;
    readonly permutationLabel?: string;
}

export interface GroupView {
    readonly path: string;
    readonly groups: readonly GroupRow[];
    readonly tokens: readonly TokenRow[];
}

type TreeDraft = { path: string; name: string; children: Map<string, TreeDraft>; hasValue?: true };

export function getSidebarTree(tokens: DesignTokens): TreeNode[] {
    const roots = new Map<string, TreeDraft>();

    function addChildren(
        children: readonly (Token | Group)[],
        level: Map<string, TreeDraft>,
        parent?: { draft: TreeDraft; group: Group },
    ) {
        for (const child of children) {
            if (parent && child === parent.group.rootToken) {
                parent.draft.hasValue = true;
                continue;
            }
            const name = parent ? child.path.slice(parent.group.path.length + 1) : child.path;
            let draft = level.get(name);
            if (!draft) {
                draft = { path: child.path, name, children: new Map() };
                level.set(name, draft);
            }
            if (child.kind === "group")
                addChildren(child.children, draft.children, { draft, group: child });
        }
    }

    for (const permutation of tokens.permutations) addChildren(permutation.children, roots);

    return Array.from(roots.values(), toTreeNode);
}

function toTreeNode(draft: TreeDraft): TreeNode {
    const children = Array.from(draft.children.values(), toTreeNode);
    const ownCount = draft.hasValue ? 1 : 0;
    return {
        path: draft.path,
        name: draft.name,
        count:
            children.length > 0
                ? ownCount + children.reduce((sum, child) => sum + child.count, 0)
                : 1,
        children,
        ...(draft.hasValue ? { hasValue: true as const } : {}),
    };
}

export function findTokenOrGroup(
    tokens: DesignTokens,
    showing: Permutation,
    path: string,
): { node: Token | Group; isShown: boolean } | undefined {
    const shownNode = showing.getTokenOrGroup(path);
    if (shownNode) return { node: shownNode, isShown: true };
    for (const permutation of tokens.permutations) {
        const otherNode = permutation.getTokenOrGroup(path);
        if (otherNode) return { node: otherNode, isShown: false };
    }
    return undefined;
}

export function getBreadcrumbs(path: string): Crumb[] {
    const names = path.split(".");
    return names.map((name, index) => ({ path: names.slice(0, index + 1).join("."), name }));
}

export function getGroupView(group: Group, value: BuildOutput["getValue"]): GroupView {
    const getChildName = (child: Token | Group) => child.path.slice(group.path.length + 1);
    return {
        path: group.path,
        groups: group.children
            .filter((child): child is Group => child.kind === "group")
            .map((child) => ({
                path: child.path,
                name: getChildName(child),
                count: child.tokens.length,
            })),
        tokens: group.childTokens.map((token) => toTokenRow(token, getChildName(token), value)),
    };
}

export interface GroupPageView extends GroupView {
    readonly form: ExtensionForm | undefined;
    readonly noTokens: "at-all" | "directly" | undefined;
    readonly description: DescriptionView;
    readonly deprecation: DeprecationView;
    readonly editable: boolean;
}

export function getGroupPageView(state: StudioState, group: Group): GroupPageView {
    const { shownPermutation, getValue, getForm } = state;
    const getShownValue = (token: Token) => {
        const shownToken = shownPermutation.getToken(token.path);
        return shownToken && getValue(shownToken);
    };
    const view = getGroupView(group, getShownValue);
    const noTokens =
        view.tokens.length > 0 ? undefined : view.groups.length > 0 ? "directly" : "at-all";
    const editable = group.inherited === undefined;
    return {
        ...view,
        form: getForm(group),
        noTokens,
        description: getDescriptionView(group, editable),
        deprecation: getDeprecationView(group, editable),
        editable,
    };
}

export function toTokenRow(token: Token, name: string, value: BuildOutput["getValue"]): TokenRow {
    return {
        path: token.path,
        name,
        type: token.type,
        originalValue: token.original?.value,
        css: value(token),
    };
}

export function toProblemRows(problems: readonly BuildProblem[]): ProblemRow[] {
    return problems.map(
        ({ span, severity, message, permutations, kind, path, relatedInformation }) => {
            const label = getPartialLabel(permutations);
            const paths = [
                ...new Set(
                    [path, ...(relatedInformation ?? []).map((each) => each.path)].filter(isPath),
                ),
            ];
            return {
                ...(span && paths.length === 0
                    ? { location: `${span.file}:${span.start.line}:${span.start.column}` }
                    : {}),
                severity,
                message,
                ...(label ? { permutationLabel: label } : {}),
                kind,
                ...(paths.length > 0 ? { paths } : {}),
            };
        },
    );
}

export function toChangeLines(changes: readonly Change[]): ChangeLine[] {
    return changes.map((change) => {
        const label = getPartialLabel(change.permutations);
        return {
            kind: change.kind,
            ...("from" in change ? { from: change.from } : {}),
            path: change.path,
            ...(change.path === "" && { topLevel: true as const }),
            ...(label ? { permutationLabel: label } : {}),
        };
    });
}

export function formatChange(line: ChangeLine): string {
    const permutationSuffix = line.permutationLabel ? ` (${line.permutationLabel})` : "";
    if (line.kind === "renamed" || line.kind === "group-renamed") {
        return `\`${line.from}\` renamed to \`${line.path}\`${permutationSuffix}`;
    }
    const subject = line.topLevel ? "Top level" : `\`${line.path}\``;
    return `${subject} ${verbByChangeKind[line.kind]}${permutationSuffix}`;
}

export const verbByChangeKind: Record<
    Exclude<ChangeLine["kind"], "renamed" | "group-renamed">,
    string
> = {
    "added": "added",
    "removed": "removed",
    "changed": "changed",
    "group-added": "added",
    "group-removed": "removed",
    "group-changed": "changed",
};

function getPartialLabel(permutations: Permutations | undefined): string | undefined {
    if (!permutations || permutations.length === 0 || permutations.others.length === 0) {
        return undefined;
    }
    return permutations.label;
}

function isPath(path: string | undefined): path is string {
    return path !== undefined;
}

export function getReferenceTargets(
    tokens: DesignTokens,
    showing: Permutation,
    type: TokenType,
    path: string | undefined,
): string[] {
    return tokens.getTokenPaths().filter((each) => {
        if (each === path) return false;
        const node = findTokenOrGroup(tokens, showing, each)?.node;
        return node?.kind !== "group" && node?.type === type;
    });
}

export function formatClashMessage({ changedHost }: { changedHost?: string | undefined }): string {
    return `Not saved: changed ${changedHost ? `on ${changedHost}` : "elsewhere"}.`;
}

export function formatSaveError(error: unknown): string {
    if (error instanceof UserFacingError) return error.message;
    return `Save failed: ${error instanceof Error ? error.message : String(error)}`;
}
