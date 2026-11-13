import type { Input } from "./permutation.js";

/**
 * Why {@link DesignTokens.getPermutation} found no permutation, with the facts behind its message.
 *
 * `"not-read"` means the input fits, but the read didn't build that permutation.
 */
export type PermutationErrorDetail = InputProblem | { reason: "not-read"; input: Input };

/** Why `readFromMemory` couldn't pick a file to start from, with the facts behind its message. */
export interface EntryFileErrorDetail {
    /**
     * - `"no-resolver"` for several token files and no resolver, or no files
     * - `"several-resolvers"` for more than one resolver
     */
    readonly reason: "no-resolver" | "several-resolvers";
    /** The files it couldn't pick from, such as `["base.json", "dark.json"]`. */
    readonly files: readonly string[];
}

/** The facts behind a {@link SeveralPermutationsError}'s message. */
export interface SeveralPermutationsDetail {
    /** What was asked, such as `"getToken()"` or `"tokens"`. */
    readonly member: string;
    /** The resolver's modifiers. */
    readonly modifiers: readonly string[];
    /** An input that picks a permutation, such as `{ mode: "dark" }`. */
    readonly example: Input;
}

/**
 * Why an input doesn't fit the resolver.
 *
 * `"unknown-modifier"` means the resolver has no such modifier.
 * `"unknown-context"` means the modifier has no such context.
 * `"missing-modifier"` means a modifier with no default is left out.
 * `"not-a-string"` means a context isn't a string.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#input-validation | Resolver 6.1, Input validation}
 */
export type InputProblem = { readonly modifier: string } & (
    | {
          readonly reason: "unknown-modifier";
          /** The modifiers the resolver declares. */
          readonly valid: readonly string[];
      }
    | {
          readonly reason: "unknown-context";
          readonly context: string;
          /** The contexts the modifier allows. */
          readonly valid: readonly string[];
      }
    | {
          readonly reason: "missing-modifier";
          /** The contexts the modifier allows. */
          readonly valid: readonly string[];
      }
    | { readonly reason: "not-a-string" }
);
