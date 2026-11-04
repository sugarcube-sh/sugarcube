import { thrownMessages } from "../error-messages.js";
import type {
    DesignTokens,
    Input,
    InputProblem,
    Permutation,
    PermutationErrorDetail,
    SeveralPermutationsDetail,
} from "../model.js";
import { checkedInput, modifiersIn } from "../read/input.js";

/**
 * Thrown when an input names a permutation the tokens don't have.
 *
 * The message says why. `detail` has the facts in the message, for writing your own.
 *
 * @example
 * // A context the resolver doesn't have
 * try {
 *     tokens.getPermutation({ mode: "sepia" });
 * } catch (error) {
 *     if (error instanceof PermutationError) {
 *         error.message;
 *         // => "`sepia` is not a context of the modifier `mode`"
 *         error.detail;
 *         // => {
 *         //     reason: "unknown-context",
 *         //     modifier: "mode",
 *         //     context: "sepia",
 *         //     valid: ["light", "dark"],
 *         // }
 *     }
 * }
 */
export class PermutationError extends Error {
    readonly detail: PermutationErrorDetail;

    constructor(detail: PermutationErrorDetail) {
        super(thrownMessages.permutation(detail));
        this.name = "PermutationError";
        this.detail = detail;
    }
}

/**
 * Thrown when a question needs one permutation, but there are several.
 *
 * Questions such as {@link DesignTokens.getToken} need one. Ask a permutation from
 * {@link DesignTokens.getPermutation} instead. The message says how. `detail` has the facts in the
 * message, for writing your own.
 *
 * @example
 * // Tokens with light and dark
 * try {
 *     tokens.getToken("color.primary");
 * } catch (error) {
 *     if (error instanceof SeveralPermutationsError) {
 *         error.message;
 *         // => "tokens.getToken() needs a permutation: this resolver has the modifier `mode`.
 *         // Pick one with tokens.getPermutation({ mode: \"dark\" }), or ask them all with
 *         // askEveryPermutation(tokens, …)"
 *         error.detail;
 *         // => { asked: "getToken()", modifiers: ["mode"], example: { mode: "dark" } }
 *     }
 * }
 */
export class SeveralPermutationsError extends Error {
    readonly detail: SeveralPermutationsDetail;

    constructor(detail: SeveralPermutationsDetail) {
        super(thrownMessages.severalPermutations(detail));
        this.name = "SeveralPermutationsError";
        this.detail = detail;
    }
}

export function onlyPermutation(tokens: DesignTokens, asked: string): Permutation {
    const [only, ...more] = tokens.permutations;
    if (only && more.length === 0) return only;
    const away = tokens.permutations.find((each) => !each.isDefault);
    const example = Object.fromEntries(
        (away?.contexts ?? [])
            .filter((context) => !context.isDefault)
            .map((context) => [context.modifier.name, context.name]),
    );
    const modifiers = modifiersIn(tokens.resolver).map(({ name }) => name);
    throw new SeveralPermutationsError({ asked, modifiers, example });
}

export function permutationIn(tokens: DesignTokens, input: Input = {}): Permutation {
    const found = findPermutation(tokens, input);
    if ("reason" in found) throw new PermutationError(found);
    return found;
}

export function findPermutation(
    tokens: DesignTokens,
    input: Input = {},
): Permutation | PermutationErrorDetail {
    const complete = completeInput(tokens, input);
    if (!complete.ok) {
        const { ok: _, ...detail } = complete;
        return detail;
    }
    return (
        tokens.permutations.findByInput(complete.input) ?? {
            reason: "not-read",
            input: complete.input,
        }
    );
}

type CompleteInput = { ok: true; input: Input } | ({ ok: false } & InputProblem);

/**
 * Fills in an input's defaults, and writes names the resolver's way.
 *
 * Names match whatever their case. If the input has a problem, it says what.
 *
 * @param tokens - Tokens from a read of the resolver the input is for.
 * @param input - The input, such as `{ mode: "dark" }`.
 * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#case-sensitivity | Resolver 5.1, Case sensitivity}
 *
 * @example
 * // Names in another case
 * completeInput(tokens, { Mode: "DARK" })
 * // => { ok: true, input: { mode: "dark" } }
 */
export function completeInput(tokens: DesignTokens, input: Input): CompleteInput {
    const checked = checkedInput(modifiersIn(tokens.resolver), input);
    return checked.ok ? checked : { ok: false, ...checked.problems[0] };
}
