import type {
    DesignTokens,
    JsonPath,
    JsonValue,
    Permutation,
    PlaceInPermutations,
    Span,
    Token,
} from "@sugarcube-sh/dtcg";
import { type Clash, type ValueOptions, overridable, setValue } from "@sugarcube-sh/dtcg-edit";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import type { ExtensionForm } from "./adapter";
import {
    type DeprecationView,
    type DescriptionView,
    deprecationView,
    descriptionView,
} from "./properties";
import type { StudioState } from "./studio";
import { type Edit, fieldKey } from "./undo";
import { type ProblemRow, type TokenRow, problemRows, tokenRow } from "./views";

export interface PlaceRow {
    readonly label: string | undefined;
    readonly value: JsonValue | undefined;
    readonly at: Span;
}

export function placeRows(tokens: DesignTokens, path: string): PlaceRow[] {
    return tokens.writtenAt(path).map((place) => ({
        label: labelOf(place),
        value: isJsonObject(place.written) ? place.written.$value : undefined,
        at: place.span,
    }));
}

export interface ValueRow {
    readonly key: string;
    readonly label: string | undefined;
    readonly value: JsonValue | undefined;
    readonly unwritten: boolean;
    readonly where: ValueOptions;
}

export function valueEdit(
    tokens: DesignTokens,
    path: string,
    row: ValueRow,
    value: JsonValue,
    part?: JsonPath,
    control?: string,
): Edit {
    return {
        result: setValue(tokens, path, value, { ...row.where, part }),
        options: {
            merge: fieldKey({ path, writes: "value", place: row.label, part, control }),
        },
    };
}

export interface ValueView {
    readonly rows: readonly ValueRow[];
    readonly offers: readonly string[];
    readonly actions: boolean;
}

export function valueView(
    tokens: DesignTokens,
    path: string,
    adding: readonly string[],
): ValueView {
    if (tokens.permutations.some((perm) => perm.token(path)?.generated)) {
        return { rows: [], offers: [], actions: false };
    }
    const places = placeRows(tokens, path);
    const offered = overridable(tokens, path);
    const written = places
        .filter((place) => place.label === undefined || !adding.includes(place.label))
        .map((place) => ({
            key: `${place.at.file}:${place.at.offset}`,
            label: place.label,
            value: place.value,
            unwritten: false,
            where: { at: place.at },
        }));
    const overrides = adding.flatMap((label): ValueRow[] => {
        const key = `adding ${label}`;
        const place = places.find((each) => each.label === label);
        if (place) {
            return [{ key, label, value: place.value, unwritten: false, where: { at: place.at } }];
        }
        const offer = offered.find((each) => each.label === label);
        if (!offer) return [];
        const inForce = tokens.permutation(offer.input).token(path)?.valueFrom.written;
        return [
            {
                key,
                label,
                value: isJsonObject(inForce) ? inForce.$value : undefined,
                unwritten: true,
                where: { input: offer.input },
            },
        ];
    });
    return {
        rows: [...written, ...overrides],
        offers: offered.map(({ label }) => label).filter((label) => !adding.includes(label)),
        actions: true,
    };
}

export type MadeBy =
    | { readonly kind: "recipe"; readonly from: string; readonly by: string }
    | { readonly kind: "group"; readonly from: string }
    | { readonly kind: "top-level" };

export function madeBy(
    token: Token,
    showing: Permutation,
    formFor: StudioState["formFor"],
): MadeBy | undefined {
    if (!token.generated) return undefined;
    const { from } = token.generated;
    if (from === undefined) return { kind: "top-level" };
    const group = showing.group(from);
    const by = group && formFor(group)?.label.toLowerCase();
    return by === undefined ? { kind: "group", from } : { kind: "recipe", from, by };
}

export interface PageRow extends ValueRow {
    readonly form: ExtensionForm | undefined;
    readonly name: string | undefined;
    readonly fieldLabel: string;
}

function pageRow(row: ValueRow, token: Token, formFor: StudioState["formFor"]): PageRow {
    const name = row.unwritten ? `Override for ${row.label}` : row.label;
    return { ...row, form: formFor(token, row.where.at), name, fieldLabel: name ?? token.path };
}

export interface TokenPageView {
    readonly row: TokenRow;
    readonly rows: readonly PageRow[];
    readonly offers: readonly string[];
    readonly actions: boolean;
    readonly problems: readonly ProblemRow[];
    readonly made: MadeBy | undefined;
    readonly form: ExtensionForm | undefined;
    readonly description: DescriptionView;
    readonly deprecation: DeprecationView;
}

export function tokenPage(
    state: StudioState,
    token: Token,
    adding: readonly string[],
): TokenPageView {
    const { tokens, showing, value, formFor } = state;
    const view = valueView(tokens, token.path, adding);
    const editable = view.actions && token.inherited === undefined;
    return {
        row: tokenRow(token, token.path, value),
        rows: view.rows.map((row) => pageRow(row, token, formFor)),
        offers: view.offers,
        actions: editable,
        problems: problemRows(tokens.diagnosticsFor(token.path)),
        made: madeBy(token, showing, formFor),
        form: formFor(token),
        description: descriptionView(token, editable),
        deprecation: deprecationView(token, editable),
    };
}

export type ClashRow = { readonly clash: Clash; readonly keepable: boolean } & (
    | { readonly kind: "renamed"; readonly from: string; readonly to: string }
    | {
          readonly kind: "changed" | "gone" | "removed";
          readonly path: string;
          readonly label: string | undefined;
          readonly yours: unknown;
          readonly theirs: unknown;
      }
);

export function clashRows(tokens: DesignTokens, clashes: readonly Clash[]): ClashRow[] {
    return clashes.map((clash) => {
        const { keepable } = clash;
        const [move] = clash.step.moved;
        if (move) return { clash, keepable, kind: "renamed", from: move.from, to: move.to };
        const [part] = clash.parts;
        const path = part?.path ?? part?.file ?? "";
        return {
            clash,
            keepable,
            kind: !keepable ? "gone" : part?.yours === undefined ? "removed" : "changed",
            path,
            label: placeRows(tokens, path).find(({ at }) => at.file === part?.file)?.label,
            yours: valueOf(part?.yours),
            theirs: valueOf(part?.theirs),
        };
    });
}

function labelOf({ sources, readIn }: PlaceInPermutations): string | undefined {
    if (sources.some((source) => source.modifier)) return readIn.label;
    return sources[0]?.sets[0]?.name;
}

function valueOf(member: JsonValue | undefined): unknown {
    return isJsonObject(member) ? member.$value : member;
}
