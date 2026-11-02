import { type Generator, defineGenerator, readFromMemory } from "@sugarcube-sh/dtcg";

type Tree = Record<string, unknown>;

const written = (tree: Tree) => `${JSON.stringify(tree, null, 2)}\n`;

const color = (seed: number) => ({
    colorSpace: "srgb",
    components: [((seed * 37) % 255) / 255, 0.2, 0.4],
});

const rem = (value: number) => ({ value, unit: "rem" });

function base(perGroup: number): Tree {
    const colors: Tree = { $type: "color", $description: "Colours." };
    const space: Tree = { $type: "dimension" };
    const text: Tree = { $type: "typography" };
    for (let i = 0; i < perGroup; i++) {
        colors[`c${i}`] = { $value: i % 3 === 0 ? color(i) : `{color.c${i - (i % 3)}}` };
        space[`s${i}`] = { $value: i % 2 === 0 ? rem(1 + (i % 5)) : `{space.s${i - 1}}` };
        text[`t${i}`] = {
            $value:
                i % 2 === 0
                    ? {
                          fontFamily: "Inter",
                          fontSize: rem(1 + (i % 8) / 8),
                          fontWeight: 400 + (i % 5) * 100,
                          letterSpacing: { value: 0.5, unit: "px" },
                          lineHeight: 1.5,
                      }
                    : `{text.t${i - 1}}`,
        };
    }
    return { color: colors, space, text };
}

function overrides(perGroup: number, every: number, group: string, value: (i: number) => unknown) {
    const tokens: Tree = {};
    for (let i = 0; i < perGroup; i += every) tokens[`${group[0]}${i}`] = { $value: value(i) };
    return { [group]: tokens };
}

const steps: Generator = defineGenerator({
    extension: ["com.example", "steps"],
    generate: (_group, extension) => ({
        ok: true,
        value: Array.from({ length: Number(extension) }, (_, i) => ({
            name: String(i + 1),
            $value: rem(0.25 * (i + 1)),
        })),
    }),
});

export function designTokens(perGroup: number, { generated = 0 } = {}) {
    const sources = [{ $ref: "base.json" }, ...(generated ? [{ $ref: "scale.json" }] : [])];
    const resolver = {
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources },
            {
                type: "modifier",
                name: "theme",
                default: "light",
                contexts: { light: [], dark: [{ $ref: "dark.json" }] },
            },
            {
                type: "modifier",
                name: "density",
                default: "regular",
                contexts: { regular: [], compact: [{ $ref: "compact.json" }] },
            },
        ],
    };
    const scale = {
        scale: { $type: "dimension", $extensions: { "com.example": { steps: generated } } },
    };
    const files = {
        "tokens.resolver.json": written(resolver),
        "base.json": written(base(perGroup)),
        "dark.json": written(overrides(perGroup, 3, "color", (i) => color(i + 99))),
        "compact.json": written(overrides(perGroup, 2, "space", (i) => rem((1 + (i % 5)) * 0.75))),
        ...(generated && { "scale.json": written(scale) }),
    };
    return readFromMemory(
        { files, entryFile: "tokens.resolver.json" },
        { generators: generated ? [steps] : [] },
    );
}
