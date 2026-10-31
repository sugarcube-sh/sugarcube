import { thrownMessages } from "../error-messages.js";
import type {
    CompleteInput,
    DesignTokens,
    Input,
    Permutation,
    PermutationErrorDetail,
    ResolverModifier,
    SeveralPermutationsDetail,
} from "../index.js";
import { checkedInput, findByName, modifiersIn } from "../read/input.js";

/**
 * Thrown by {@link DesignTokens.permutation} when there is no permutation for the input. The
 * message says why in plain words; `detail` holds the facts it is worded from, for a tool to word
 * it itself.
 *
 * @example
 * try {
 *   tokens.permutation({ mode: "sepia" });
 * } catch (error) {
 *   if (error instanceof PermutationError) error.detail // { reason: "unknown-context", … }
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
 * Thrown by a question of one permutation asked of design tokens with several, such as
 * {@link DesignTokens.token}: which permutation it is for has to be said. The message says how to
 * pick one; `detail` holds the facts it is worded from.
 *
 * @example
 * try {
 *   tokens.token("color.text");
 * } catch (error) {
 *   if (error instanceof SeveralPermutationsError) error.detail.example // { mode: "dark" }
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
        tokens.permutations.matching(complete.input) ?? {
            reason: "not-read",
            input: complete.input,
        }
    );
}

/**
 * An input with every modifier given, defaults filled in, and each name as the resolver writes
 * it, or why there is none. Names match whatever their case, as the resolver spec asks.
 *
 * @example
 * completeInput(tokens, { Theme: "DARK" })   // { ok: true, input: { theme: "dark", density: "comfy" } }
 * completeInput(tokens, { theme: "sepia" })  // { ok: false, reason: "unknown-context", modifier: "theme", context: "sepia", valid: ["light", "dark"] }
 */
export function completeInput(tokens: DesignTokens, input: Input): CompleteInput {
    const checked = checkedInput(modifiersIn(tokens.resolver), input);
    return checked.ok ? checked : { ok: false, ...checked.problems[0] };
}

export function modifierIn(tokens: DesignTokens, name: string): ResolverModifier | undefined {
    return findByName(tokens.resolver?.modifiers ?? [], name, (each) => each.name);
}
