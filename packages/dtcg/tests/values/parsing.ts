import { expect } from "vitest";
import type { ParseOptions, TokenType } from "../../src/index.js";
import { parseValue } from "../../src/values.js";

export const lenient: ParseOptions = { ignoreUnknownProperties: true };

export function parsing<Type extends TokenType>(type: Type) {
    const parse = (raw: unknown, options?: ParseOptions) =>
        parseValue(type, raw, { jsonPath: ["$value"], ...options });

    function read(raw: unknown, options?: ParseOptions) {
        const result = parse(raw, options);
        if (!result.ok) throw new Error(`expected a value, got ${JSON.stringify(result.errors)}`);
        return result.value;
    }

    function details(raw: unknown, options?: ParseOptions) {
        const result = parse(raw, options);
        if (result.ok) throw new Error(`expected errors, got ${JSON.stringify(result.value)}`);
        return result.errors.map(({ jsonPath, detail }) => ({ jsonPath, detail }));
    }

    function ignored(raw: unknown, options?: ParseOptions) {
        return parse(raw, options).ignored.map(({ jsonPath, detail }) => ({ jsonPath, detail }));
    }

    function reasons(raw: unknown, options?: ParseOptions) {
        return details(raw, options).map(({ jsonPath, detail }) => [
            jsonPath,
            detail.type,
            detail.reason,
        ]);
    }

    function refuses(
        raw: unknown,
        at: readonly (string | number)[],
        detail: Record<string, unknown>,
        options?: ParseOptions,
    ) {
        expect(details(raw, options)).toStrictEqual([
            { jsonPath: ["$value", ...at], detail: { type, ...detail } },
        ]);
    }

    return { read, details, ignored, reasons, refuses };
}
