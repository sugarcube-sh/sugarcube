import type { Definition } from "./definition.js";
import type { JsonValue } from "./json.js";
import type { Reference } from "./reference.js";
import type { OriginalProperties, Token } from "./token.js";
import type { TokenType } from "./value.js";

/** A group of tokens. */
export interface Group {
    /**
     * Tells a group from a token.
     *
     * A JSON object without `$value` is a group.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#group-structure | Format 6.1, Group Structure}
     */
    readonly kind: "group";
    /** Where the group is, such as `"color.blue"`; `""` for the top level of the files. */
    readonly path: string;
    /**
     * The type its tokens take, such as `"color"`.
     *
     * It's the group's own `$type`, or else the type of the group it extends. Otherwise it's the
     * type of the group it's inside.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#type-inheritance | Format 6.7.3, Type Inheritance}
     */
    readonly type?: TokenType;
    /** The group's `$description`, or else the one of the group it extends. */
    readonly description?: string;
    /**
     * `true`, or a message saying what to use instead.
     *
     * It can come from the group it extends, or the group it's inside. It's absent when the group
     * isn't deprecated, even if it writes `"$deprecated": false`.
     */
    readonly deprecated?: true | string;
    /**
     * The group whose `$deprecated` applies to this one.
     *
     * It's the group it extends, or else the nearest group above; `""` when it's the top of the
     * file. It's absent when the group writes its own, or when there's none.
     */
    readonly deprecatedByGroup?: string;
    /**
     * The group's `$extensions`, and any from the group it extends.
     *
     * Where both have a key, the group's own wins.
     */
    readonly extensions?: Readonly<Record<string, JsonValue>>;
    /**
     * The group this one extends, through `$extends`.
     *
     * It's absent if the reference doesn't reach a group. The reference is in
     * {@link Group.references | references}. The tokens it brings are marked
     * {@link TokenBase.inherited | inherited}.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#extending-groups | Format 6.4, Extending Groups}
     */
    readonly extends?: Group;
    /**
     * The group's `$extends`, as a reference.
     *
     * It's empty when the group doesn't extend another.
     */
    readonly references: readonly Reference[];
    /**
     * Every place a file writes the group, in the order read.
     *
     * A group can be spread across files, so there can be several. A group that's only
     * {@link Group.inherited | inherited} has none.
     */
    readonly definitions: readonly Definition[];
    /**
     * Where each of the group's own `$extensions` keys is written.
     *
     * When several files write a key, it's the last one read. Its value for that key is used whole.
     * Keys from a group it extends are left out.
     */
    readonly extensionDefinitions: Readonly<Record<string, Definition>>;
    /**
     * Set when the group is here only through `$extends`.
     *
     * `from` is the group it comes from.
     */
    readonly inherited?: { readonly from: string };
    /**
     * The `$type`, `$description`, `$deprecated` and `$extensions` written on the group.
     *
     * It leaves out what comes from other groups. It's absent when the files write none of them.
     *
     * @example
     * // The color group writes its own $type
     * dark.getGroup("color")!.original
     * // => { type: "color" }
     */
    readonly original?: OriginalProperties;
    /**
     * The group's tokens and groups, one level down, in the order written.
     *
     * What a later file adds comes after. Tokens from `$extends` or a {@link Generator} come last.
     * Each has a {@link TokenBase.kind | kind}.
     *
     * @example
     * // The color group
     * dark.getGroup("color")!.children.map((child) => child.path)
     * // => ["color.blue", "color.primary"]
     */
    readonly children: readonly (Token | Group)[];
    /**
     * The group's `$root` token, if it has one.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#root-tokens-in-groups | Format 6.2, Root Tokens in Groups}
     */
    readonly rootToken?: Token;
    /**
     * The tokens directly in the group, in the order of {@link Group.children | children}.
     *
     * It includes the `$root` token.
     *
     * @example
     * // The color group
     * dark.getGroup("color")!.childTokens.map((token) => token.path)
     * // => ["color.primary"]
     */
    readonly childTokens: readonly Token[];
    /**
     * Every token in the group, however deep, in the order written.
     *
     * It includes the `$root` token. For only the tokens directly in it, use
     * {@link Group.childTokens | childTokens}.
     *
     * @example
     * // The color group
     * dark.getGroup("color")!.tokens.map((token) => token.path)
     * // => ["color.blue.500", "color.blue.300", "color.primary"]
     */
    readonly tokens: readonly Token[];
}

type GroupFields = Omit<Group, "kind" | "childTokens" | "tokens">;

class GroupObject {
    #childTokens: readonly Token[] | undefined;
    #tokens: readonly Token[] | undefined;

    constructor(fields: GroupFields) {
        Object.assign(this, fields);
    }

    get childTokens(): readonly Token[] {
        this.#childTokens ??= (this as unknown as Group).children.filter(
            (child): child is Token => child.kind === "token",
        );
        return this.#childTokens;
    }

    get tokens(): readonly Token[] {
        this.#tokens ??= allTokens((this as unknown as Group).children);
        return this.#tokens;
    }

    toJSON() {
        const group = this as unknown as Group;
        return {
            ...group,
            extends: undefined,
            rootToken: undefined,
            children: paths(group.children),
        };
    }
}

Object.defineProperty(GroupObject.prototype, "kind", { value: "group" });

export function allTokens(children: readonly (Token | Group)[], found: Token[] = []): Token[] {
    for (const child of children) {
        if (child.kind === "token") found.push(child);
        else allTokens(child.children, found);
    }
    return found;
}

export function createGroupObject(fields: GroupFields): Group {
    return new GroupObject(fields) as unknown as Group;
}

export function paths(items: readonly (Token | Group)[]): string[] {
    return items.map(({ path }) => path);
}
