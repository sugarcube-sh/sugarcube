import { copyFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
    type Document,
    type Fix,
    type Input,
    type TokenType,
    permutation as permutationFor,
    read,
} from "@sugarcube-sh/dtcg";
import { compositeParts, parseValue } from "@sugarcube-sh/dtcg/values";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { loadTokens } from "../src/node/load-tokens.js";
import { scaleGenerator } from "../src/shared/scale/generator.js";
import { resolveTokens } from "../src/shared/resolve-tokens.js";

const repo = join(import.meta.dirname, "../../..");
const fixtures = join(repo, "packages/core/tests/__fixtures__");
const registry = join(repo, "apps/www/registry/tokens");

interface Case {
    name: string;
    resolver?: string;
    files?: string[];
    inputs?: Input[];
    expected?: string[];
}

const typographyWithoutAllFiveParts = (label: string) => [
    `${label} typography.style.code: not read`,
    `${label} typography.style.heading: not read`,
];

const cases: Case[] = [
    ...[
        "breakpoint-cascade",
        "breakpoint-distinct",
        "breakpoint-shared",
        "complex",
        "multiple-modifiers",
        "no-modifiers",
        "non-orthogonal-modifiers",
        "private-sets",
        "private-source",
        "propagate-chain",
        "scheme",
        "simple",
        "with-extending",
        "with-file-refs",
        "with-refs",
    ].map((name) => ({
        name: `core/resolver/${name}`,
        resolver: join(fixtures, "resolver", `${name}.resolver.json`),
    })),
    {
        name: "core/resolver/provenance",
        resolver: join(fixtures, "resolver/provenance/provenance.resolver.json"),
    },
    { name: "core/tokens/basic", resolver: join(fixtures, "tokens/basic.resolver.json") },
    ...["colors", "fluid", "metadata", "references", "tokens", "utility-basic"].map((name) => ({
        name: `core/tokens/${name}`,
        files: [join(fixtures, "tokens", `${name}.json`)],
    })),
    {
        name: "core/tokens/glob",
        files: [join(fixtures, "tokens/glob/a.json"), join(fixtures, "tokens/glob/b.json")],
    },
    {
        name: "cli/valid-tokens",
        files: [join(repo, "packages/cli/tests/__fixtures__/valid-tokens.json")],
    },
    {
        name: "cli/e2e-minimal",
        resolver: join(repo, "packages/cli/tests/e2e/__fixtures__/minimal.resolver.json"),
    },
    {
        name: "studio/demo",
        resolver: join(repo, "packages/studio/demo/tokens.resolver.json"),
        expected: [
            "diagnostic invalid-value missing-property typography.style.code",
            "diagnostic invalid-value missing-property typography.style.heading",
            "diagnostic invalid-value missing-property typography.style.heading",
            "diagnostic invalid-value missing-property typography.style.heading",
            ...typographyWithoutAllFiveParts("mode=light"),
            ...typographyWithoutAllFiveParts("mode=dark"),
        ],
    },
    {
        name: "studio/design-tokens",
        resolver: join(repo, "packages/studio/src/design-tokens/tokens.resolver.json"),
        inputs: [{}, { variant: "accent" }, { variant: "neutral" }],
    },
    {
        name: "registry/starter-kits/fluid",
        resolver: join(registry, "starter-kits/fluid/tokens.resolver.json"),
    },
    {
        name: "registry/starter-kits/static",
        resolver: join(registry, "starter-kits/static/tokens.resolver.json"),
    },
    {
        name: "every-value-form/native",
        resolver: join(
            repo,
            "packages/cli/tests/__fixtures__/every-value-form/tokens.resolver.json",
        ),
        inputs: [{ theme: "light" }, { theme: "dark" }, { theme: "dark" }],
        expected: [
            "diagnostic invalid-value missing-property typography.partial",
            "diagnostic invalid-value missing-property typography.partial",
            "diagnostic invalid-value missing-property typography.partial",
            "theme=dark typography.partial: not read",
            "theme=dark typography.partial: not read",
            "theme=light typography.partial: not read",
        ],
    },
    {
        name: "every-value-form/polyfill",
        resolver: join(
            repo,
            "packages/cli/tests/__fixtures__/every-value-form/polyfill/tokens.resolver.json",
        ),
        inputs: [{}, { theme: "dark" }],
    },
    ...["size-demo", "space-demo"].map((name) => ({
        name: `registry/recipes/${name}`,
        files: [join(registry, "recipes", `${name}.json`)],
    })),
];

function resolverFor({ resolver, files = [] }: Case): string {
    if (resolver) return resolver;
    const dir = mkdtempSync(join(tmpdir(), "token-parity-"));
    for (const file of files) copyFileSync(file, join(dir, basename(file)));
    const path = join(dir, "tokens.resolver.json");
    const sources = files.map((file) => ({ $ref: basename(file) }));
    writeFileSync(
        path,
        JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources }],
        }),
    );
    return path;
}

function labelOf(input: Input): string {
    const pairs = Object.entries(input).sort(([a], [b]) => a.localeCompare(b));
    return pairs.length === 0 ? "default" : pairs.map(([k, v]) => `${k}=${v}`).join(",");
}

async function readOld(resolver: string, inputs: Input[] | undefined) {
    const config = fillDefaults({
        resolver,
        ...(inputs && {
            variables: { permutations: inputs.map((input) => ({ input, selector: ":root" })) },
        }),
    });
    const loaded = await loadTokens({ type: "resolver", resolverPath: resolver, config });
    const { resolved, errors } = resolveTokens(loaded.trees);
    const problems = [...loaded.errors, ...Object.values(errors).flat()];
    const permutations = loaded.permutations.map(({ input }, i) => {
        const prefix = `perm:${i}.`;
        const tokens = new Map<string, { type: TokenType; value: unknown }>();
        for (const [key, node] of Object.entries(resolved)) {
            if (!key.startsWith(prefix) || !("$resolvedValue" in node)) continue;
            tokens.set(node.$path, { type: node.$type, value: node.$resolvedValue });
        }
        return { input, tokens };
    });
    return { permutations, problems };
}

function safeEdits(doc: Document): Map<string, Fix["edits"]> {
    const edits = new Map<string, Fix["edits"]>();
    for (const fix of doc.diagnostics.flatMap((d) => d.fixes ?? [])) {
        if (!fix.safe) continue;
        for (const edit of fix.edits) {
            const inFile = edits.get(edit.file) ?? [];
            if (!inFile.some((each) => each.offset === edit.offset)) inFile.push(edit);
            edits.set(edit.file, inFile);
        }
    }
    return edits;
}

async function readMigrated(resolver: string, inputs: Input[]): Promise<Document> {
    const options = { generators: [scaleGenerator], inputs };
    const asWritten = await read(resolver, { ...options, readText: (p) => readFile(p, "utf8") });
    const edits = safeEdits(asWritten);
    return read(resolver, {
        ...options,
        readText: async (path) => {
            let text = await readFile(path, "utf8");
            const file = [...edits.keys()].find(
                (each) => path === each || path.endsWith(`/${each}`),
            );
            const inFile = [...(edits.get(file ?? "") ?? [])].sort((a, b) => b.offset - a.offset);
            for (const { offset, length, text: replacement } of inFile) {
                text = text.slice(0, offset) + replacement + text.slice(offset + length);
            }
            return text;
        },
    });
}

function rounded(value: number): number {
    return Math.round(value * 10_000) / 10_000;
}

function hexAsColor(hex: string): unknown {
    if (!/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return hex;
    const digits = hex.slice(1);
    const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
    const channel = (at: number) => rounded(Number.parseInt(full.slice(at, at + 2), 16) / 255);
    return {
        colorSpace: "srgb",
        components: [channel(0), channel(2), channel(4)],
        ...(full.length === 8 && { alpha: channel(6) }),
        hex: `#${full.slice(0, 6)}`,
    };
}

function withHexAsColors(type: TokenType | "boolean", value: unknown): unknown {
    if (type === "color") return typeof value === "string" ? hexAsColor(value) : value;
    const parts: Readonly<Record<string, TokenType | "boolean">> | undefined =
        compositeParts[type as keyof typeof compositeParts];
    if (!parts) return value;
    const each = (item: unknown) =>
        typeof item === "object" && item !== null && !Array.isArray(item)
            ? Object.fromEntries(
                  Object.entries(item).map(([name, part]) => [
                      name,
                      parts[name] ? withHexAsColors(parts[name], part) : part,
                  ]),
              )
            : item;
    return Array.isArray(value) ? value.map(each) : each(value);
}

async function differences(each: Case): Promise<string[]> {
    const resolver = resolverFor(each);
    const old = await readOld(resolver, each.inputs);
    const found = old.problems.map(({ message }) => `old sugarcube reports: ${message}`);

    const inputs = old.permutations.map(({ input }) => input);
    const doc = await readMigrated(resolver, inputs);
    for (const { kind, detail, path } of doc.diagnostics) {
        const reason = "reason" in detail ? ` ${String(detail.reason)}` : "";
        found.push(`diagnostic ${kind}${reason} ${path ?? ""}`.trimEnd());
    }

    for (const { input, tokens } of old.permutations) {
        const permutation = permutationFor(doc, input);
        if (!permutation) {
            found.push(`no permutation for ${JSON.stringify(input)}`);
            continue;
        }
        const label = labelOf(permutation.input);
        const newTokens = new Map(permutation.tokens.map((token) => [token.path, token]));
        for (const [path, { type, value }] of tokens) {
            const token = newTokens.get(path);
            if (!token) {
                found.push(`${label} ${path}: only in old sugarcube`);
                continue;
            }
            if (token.type !== type) {
                found.push(`${label} ${path}: ${type} in old sugarcube, ${token.type} in dtcg`);
                continue;
            }
            if (token.invalid) {
                found.push(`${label} ${path}: not read`);
                continue;
            }
            const converted = parseValue(type, withHexAsColors(type, value), [], {
                references: false,
            });
            if (!converted.ok) {
                found.push(`${label} ${path}: ${JSON.stringify(value)} has no dtcg shape`);
            } else if (JSON.stringify(converted.value) !== JSON.stringify(token.resolved)) {
                found.push(
                    `${label} ${path}: ${JSON.stringify(converted.value)} in old sugarcube, ${JSON.stringify(token.resolved)} in dtcg`,
                );
            }
        }
        for (const path of newTokens.keys()) {
            if (!tokens.has(path)) found.push(`${label} ${path}: only in dtcg`);
        }
    }
    return found.sort();
}

describe("token parity: old sugarcube and dtcg read every golden case to the same tokens", () => {
    it.for(cases)("$name", async (each) => {
        expect(await differences(each)).toStrictEqual([...(each.expected ?? [])].sort());
    });
});
