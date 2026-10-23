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
    deprecationView,
    descriptionView,
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
    readonly written: unknown;
    readonly css: string | TypographyCSS | undefined;
}

export interface ProblemRow {
    readonly place?: string;
    readonly severity: BuildProblem["severity"];
    readonly message: string;
    readonly inPermutations?: string;
    readonly kind: string;
    readonly paths?: readonly string[];
}

export interface ChangeLine {
    readonly kind: Change["kind"];
    readonly path?: string;
    readonly from?: string;
    readonly inPermutations?: string;
}

export interface GroupView {
    readonly path: string;
    readonly groups: readonly GroupRow[];
    readonly tokens: readonly TokenRow[];
}

type Draft = { path: string; name: string; children: Map<string, Draft>; hasValue?: true };

export function sidebarTree(tokens: DesignTokens): TreeNode[] {
    const roots = new Map<string, Draft>();

    function place(
        children: readonly (Token | Group)[],
        level: Map<string, Draft>,
        parent?: { draft: Draft; group: Group },
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
                place(child.children, draft.children, { draft, group: child });
        }
    }

    for (const permutation of tokens.permutations) place(permutation.children, roots);

    return Array.from(roots.values(), finish);
}

function finish(draft: Draft): TreeNode {
    const children = Array.from(draft.children.values(), finish);
    const own = draft.hasValue ? 1 : 0;
    return {
        path: draft.path,
        name: draft.name,
        count:
            children.length > 0 ? own + children.reduce((sum, child) => sum + child.count, 0) : 1,
        children,
        ...(draft.hasValue ? { hasValue: true as const } : {}),
    };
}

export function nodeAt(
    tokens: DesignTokens,
    showing: Permutation,
    path: string,
): { node: Token | Group; shown: boolean } | undefined {
    const here = showing.token(path) ?? showing.group(path);
    if (here) return { node: here, shown: true };
    for (const permutation of tokens.permutations) {
        const there = permutation.token(path) ?? permutation.group(path);
        if (there) return { node: there, shown: false };
    }
    return undefined;
}

export function trail(path: string): Crumb[] {
    const names = path.split(".");
    return names.map((name, index) => ({ path: names.slice(0, index + 1).join("."), name }));
}

export function groupView(group: Group, value: BuildOutput["value"]): GroupView {
    const below = (child: Token | Group) => child.path.slice(group.path.length + 1);
    return {
        path: group.path,
        groups: group.children
            .filter((child): child is Group => child.kind === "group")
            .map((child) => ({ path: child.path, name: below(child), count: child.tokens.length })),
        tokens: group.childTokens.map((token) => tokenRow(token, below(token), value)),
    };
}

export interface GroupPageView extends GroupView {
    readonly form: ExtensionForm | undefined;
    readonly noTokens: "at-all" | "directly" | undefined;
    readonly description: DescriptionView;
    readonly deprecation: DeprecationView;
    readonly actions: boolean;
}

export function groupPage(state: StudioState, group: Group): GroupPageView {
    const { showing, value, formFor } = state;
    const shownValue = (token: Token) => {
        const here = showing.token(token.path);
        return here && value(here);
    };
    const view = groupView(group, shownValue);
    const noTokens =
        view.tokens.length > 0 ? undefined : view.groups.length > 0 ? "directly" : "at-all";
    const editable = group.inherited === undefined;
    return {
        ...view,
        form: formFor(group),
        noTokens,
        description: descriptionView(group, editable),
        deprecation: deprecationView(group, editable),
        actions: editable,
    };
}

export function tokenRow(token: Token, name: string, value: BuildOutput["value"]): TokenRow {
    return {
        path: token.path,
        name,
        type: token.type,
        written: token.authored?.value,
        css: value(token),
    };
}

export function problemRows(problems: readonly BuildProblem[]): ProblemRow[] {
    return problems.map(({ span, severity, message, permutations, kind, path, related }) => {
        const label = partialLabel(permutations);
        const paths = [
            ...new Set([path, ...(related ?? []).map((each) => each.path)].filter(isPath)),
        ];
        return {
            ...(span && paths.length === 0
                ? { place: `${span.file}:${span.start.line}:${span.start.column}` }
                : {}),
            severity,
            message,
            ...(label ? { inPermutations: label } : {}),
            kind,
            ...(paths.length > 0 ? { paths } : {}),
        };
    });
}

export function changeLines(changes: readonly Change[]): ChangeLine[] {
    return changes.map((change) => {
        const label = partialLabel(change.permutations);
        return {
            kind: change.kind,
            ...("from" in change ? { from: change.from } : {}),
            ...("path" in change ? { path: change.path } : {}),
            ...(label ? { inPermutations: label } : {}),
        };
    });
}

export function changeText(line: ChangeLine): string {
    const theme = line.inPermutations ? ` (${line.inPermutations})` : "";
    if (line.kind === "renamed" || line.kind === "group-renamed") {
        return `\`${line.from}\` renamed to \`${line.path}\`${theme}`;
    }
    const what = line.path ? `\`${line.path}\`` : "Top level";
    return `${what} ${doneWord[line.kind]}${theme}`;
}

export const doneWord: Record<Exclude<ChangeLine["kind"], "renamed" | "group-renamed">, string> = {
    "added": "added",
    "removed": "removed",
    "changed": "changed",
    "group-added": "added",
    "group-removed": "removed",
    "group-changed": "changed",
    "top-level-changed": "changed",
};

function partialLabel(permutations: Permutations | undefined): string | undefined {
    const label = permutations?.label;
    return label === "everywhere" || label === "nowhere" ? undefined : label;
}

function isPath(path: string | undefined): path is string {
    return path !== undefined;
}

export function referable(
    tokens: DesignTokens,
    showing: Permutation,
    type: TokenType,
    path: string | undefined,
): string[] {
    return tokens.tokenPaths().filter((each) => {
        if (each === path) return false;
        const node = nodeAt(tokens, showing, each)?.node;
        return node?.kind !== "group" && node?.type === type;
    });
}

export function clashText({ changedOn }: { changedOn?: string | undefined }): string {
    return `Not saved: changed ${changedOn ? `on ${changedOn}` : "elsewhere"}.`;
}

export function failedText(error: unknown): string {
    if (error instanceof UserFacingError) return error.message;
    return `Save failed: ${error instanceof Error ? error.message : String(error)}`;
}
