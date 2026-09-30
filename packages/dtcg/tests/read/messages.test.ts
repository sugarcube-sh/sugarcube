import { describe, expect, it } from "vitest";
import { diagnosticMessages } from "../../src/error-messages.js";
import type { DiagnosticDetailByKind, DiagnosticKind } from "../../src/index.js";

const examples: { [K in DiagnosticKind]: DiagnosticDetailByKind[K][] } = {
    "file-not-found": [
        { file: "dark.json" },
        { file: "dark.json", referencedFrom: "tokens.resolver.json" },
    ],
    "invalid-json": [
        { reason: "comment" },
        { reason: "not-an-object" },
        { reason: "comma-expected" },
    ],
    "duplicate-key": [{ key: "brand" }],
    "resolver-invalid": [
        { rule: "version" },
        { rule: "unknown-set", name: "base" },
        { rule: "unknown-modifier", name: "theme" },
        { rule: "invalid-pointer", name: "#/modifiers/theme" },
        { rule: "circular-reference", name: "#/sets/base" },
        { rule: "duplicate-name", name: "base" },
        { rule: "no-contexts", name: "theme" },
        { rule: "single-context", name: "theme" },
        { rule: "invalid-default", name: "theme" },
    ],
    "input-invalid": [
        { reason: "unknown-modifier", modifier: "size" },
        { reason: "unknown-context", modifier: "theme", context: "blue", valid: ["light", "dark"] },
        { reason: "missing-modifier", modifier: "theme" },
        { reason: "not-a-string", modifier: "beta" },
    ],
    "invalid-name": [
        { name: "$brand", character: "$" },
        { name: "a.b", character: "." },
    ],
    "token-and-group": [{}],
    "missing-type": [{}],
    "unknown-type": [{ type: "colour" }],
    "invalid-value": [{ type: "color", at: ["$value"], reason: "wrong-shape" }],
    "hex-string-color": [{ value: "#e11d48" }],
    "extension-invalid": [{ key: "sh.sugarcube.fluid" }],
    "missing-reference": [{ ref: "color.brnad", referencedBy: ["color.danger"] }],
    "circular-reference": [{ chain: ["color.a", "color.b", "color.a"] }],
    "type-mismatch": [{ ref: "space.md", expected: "color", found: "dimension" }],
    "whitespace-in-name": [{ name: "brand " }],
    "generator-overridden": [{ generator: "scale", group: "space", name: "md" }],
    "deprecated-reference": [{ ref: "color.old" }, { ref: "color.old", reason: "use color.brand" }],
};

const messages = (Object.keys(examples) as DiagnosticKind[]).flatMap((kind) =>
    examples[kind].map((detail) => ({
        kind,
        message: (diagnosticMessages[kind].message as (detail: unknown) => string)(detail),
    })),
);

describe("diagnostic messages", () => {
    it("has an entry for every kind", () => {
        expect(Object.keys(diagnosticMessages).sort()).toStrictEqual(Object.keys(examples).sort());
    });

    it.for(messages)("words $kind as plain text: $message", ({ message }) => {
        expect(message).not.toBe("");
        expect(message).toMatch(/^[^A-Z]/);
        expect(message).not.toMatch(/\.$/);
        expect(message).not.toMatch(/(^|\s)(sugarcube|npx|pnpm|npm)\s|\s--?[a-z]/);
        expect(message).not.toMatch(/did you mean/i);
    });
});
