import type { Group } from "./group.js";
import type { Permutations } from "./permutations.js";
import type { LocalGroup, LocalToken } from "./definition.js";
import type { Token } from "./token.js";

/** A token or group's new path, such as `{ from: "color.blue", to: "color.azure" }`. */
export interface Move {
    readonly from: string;
    readonly to: string;
}

/** A property a file can set on a token, without its `$`, such as `"value"`. */
export type TokenProperty = "value" | "type" | "description" | "deprecated" | "extensions";

/** A property a file can set on a group, without its `$`, such as `"extends"`. */
export type GroupProperty = "type" | "description" | "deprecated" | "extensions" | "extends";

/**
 * One difference between two reads, as {@link DesignTokens.getChangesSince} returns it.
 *
 * `before` and `after` are what the files wrote, and `properties` lists what differs. Check `kind`,
 * and TypeScript knows the rest.
 *
 * @example
 * // color.blue.500 has a new value
 * change
 * // => {
 * //     kind: "changed",
 * //     path: "color.blue.500",
 * //     properties: ["value"],
 * //     before: { value: { colorSpace: "srgb", components: [0.2, 0.4, 0.8] } },
 * //     after: { value: { colorSpace: "srgb", components: [0.1, 0.4, 0.8] } },
 * //     permutations: [light, dark],
 * // }
 */
export type Change =
    | ({
          readonly kind: "added";
          readonly path: string;
          readonly after: LocalToken;
      } & TokenChange)
    | ({
          readonly kind: "removed";
          readonly path: string;
          readonly before: LocalToken;
      } & TokenChange)
    | ({
          readonly kind: "changed";
          readonly path: string;
          readonly properties: readonly TokenProperty[];
          readonly before: LocalToken;
          readonly after: LocalToken;
      } & TokenChange)
    | ({
          readonly kind: "renamed";
          readonly from: string;
          readonly path: string;
          readonly properties: readonly TokenProperty[];
          readonly before: LocalToken;
          readonly after: LocalToken;
      } & TokenChange)
    | ({
          readonly kind: "group-added";
          readonly path: string;
          readonly after: LocalGroup;
      } & GroupChange)
    | ({
          readonly kind: "group-removed";
          readonly path: string;
          readonly before: LocalGroup;
      } & GroupChange)
    | ({
          readonly kind: "group-changed";
          readonly path: string;
          readonly properties: readonly GroupProperty[];
          readonly before: LocalGroup;
          readonly after: LocalGroup;
      } & GroupChange)
    | ({
          readonly kind: "group-renamed";
          readonly from: string;
          readonly path: string;
          readonly properties: readonly GroupProperty[];
          readonly before: LocalGroup;
          readonly after: LocalGroup;
      } & GroupChange);

/** What every change to a token has, as well as `before` and `after`. */
export interface TokenChange {
    /** The permutations the change is in. */
    readonly permutations: Permutations;
    /** Set when a {@link Generator} makes the token, as {@link TokenBase.generatedFrom}. */
    readonly generatedFrom?: Token["generatedFrom"];
    /** Set when the token is here only through `$extends`, as {@link TokenBase.extendedFrom}. */
    readonly extendedFrom?: Token["extendedFrom"];
}

/** What every change to a group has, as well as `before` and `after`. */
export interface GroupChange {
    /** The permutations the change is in. */
    readonly permutations: Permutations;
    /** Set when the group is here only through `$extends`, as {@link Group.extendedFrom}. */
    readonly extendedFrom?: Group["extendedFrom"];
}
