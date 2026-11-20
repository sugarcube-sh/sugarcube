import type { Definition } from "./definition.js";
import type { JsonValue } from "./json.js";
import type { Reference } from "./reference.js";
import type { LocalGroup } from "./definition.js";
import type { InheritedFrom, Token } from "./token.js";
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
    /**
     * Where the group's type comes from, when it doesn't write `$type` itself.
     *
     * `via` is `"extends"` when it comes through its `$extends`, and `"group"` when a group it's
     * inside gives it. `path` names the group that writes the `$type`, `""` for the top of the file.
     *
     * @see {@link https://www.designtokens.org/TR/2025.10/format/#type-inheritance | Format 6.7.3, Type Inheritance}
     *
     * @example
     * // cta writes "$extends": "{button}", and button writes "$type": "dimension"
     * light.getGroup("cta")!.typeFrom
     * // => { path: "button", via: "extends" }
     */
    readonly typeFrom?: InheritedFrom;
    /** The group's `$description`, or else the one of the group it extends. */
    readonly description?: string;
    /**
     * Where the group's description comes from, when it doesn't write `$description` itself.
     *
     * A description comes only through `$extends`, so `via` is always `"extends"`. `path` names
     * the group that writes it, which can be further along a chain of `$extends`.
     *
     * @example
     * // cta extends button, and button writes "$description": "Every button"
     * light.getGroup("cta")!.descriptionFrom
     * // => { path: "button", via: "extends" }
     */
    readonly descriptionFrom?: InheritedFrom;
    /**
     * `true`, or a message saying what to use instead.
     *
     * It can come from the group it extends, or the group it's inside. It's absent when the group
     * isn't deprecated, even if it writes `"$deprecated": false`.
     */
    readonly deprecated?: true | string;
    /**
     * Where the group's deprecation comes from, when it doesn't write `$deprecated` itself.
     *
     * `via` is `"extends"` when it comes through its `$extends`, and `"group"` when a group it's
     * inside gives it. `path` names the group that writes the `$deprecated`, `""` for the top of
     * the file.
     *
     * @example
     * // cta extends button, and button writes "$deprecated": "Use action"
     * light.getGroup("cta")!.deprecatedFrom
     * // => { path: "button", via: "extends" }
     */
    readonly deprecatedFrom?: InheritedFrom;
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
     * {@link TokenBase.extendedFrom | extendedFrom}.
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
     * {@link Group.extendedFrom | inherited} has none.
     */
    readonly definitions: readonly Definition[];
    /**
     * Where each of the group's `$extensions` keys is written, its own or through `$extends`.
     *
     * When several files write a key, it's the last one read. Its value for that key is used whole.
     * Where the group and a group it extends both write a key, the group's own wins.
     */
    readonly extensionDefinitions: Readonly<Record<string, Definition>>;
    /**
     * Set when the group is here only through `$extends`, as a copy.
     *
     * `path` names the group it's a copy of, where it's written.
     *
     * @example
     * // cta extends button, which has a group sizes inside
     * light.getGroup("cta.sizes")!.extendedFrom
     * // => { path: "button.sizes" }
     */
    readonly extendedFrom?: { readonly path: string };
    /**
     * The properties the files write on the group itself, not inherited.
     *
     * A group can be written in several files. This combines them, the later file winning each
     * property. It's absent when the files write none of them.
     *
     * @example
     * // cta writes "$extends": "{button}" and nothing else
     * light.getGroup("cta")!.local
     * // => { extends: "button" }
     */
    readonly local?: LocalGroup;
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
