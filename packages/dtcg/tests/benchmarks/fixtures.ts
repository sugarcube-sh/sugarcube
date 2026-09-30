type Tree = Record<string, unknown>;

const color = (seed: number) => ({
    colorSpace: "srgb",
    components: [((seed * 37) % 255) / 255, 0.2, 0.4],
    hex: "#e11d48",
});

export function tokens(perGroup: number): Tree {
    const colors: Tree = { $type: "color" };
    const space: Tree = { $type: "dimension" };
    const text: Tree = { $type: "typography" };
    for (let i = 0; i < perGroup; i++) {
        const base = Math.floor(i / 3) * 3;
        colors[`c${i}`] = { $value: i % 3 === 0 ? color(i) : `{color.c${base}}` };
        space[`s${i}`] = {
            $value: i % 2 === 0 ? { value: 1 + (i % 5), unit: "rem" } : `{space.s${i - 1}}`,
        };
        text[`t${i}`] = {
            $value:
                i % 2 === 0
                    ? {
                          fontFamily: "Inter",
                          fontSize: { value: 16 + (i % 8), unit: "px" },
                          fontWeight: 400 + (i % 5) * 100,
                          letterSpacing: { value: 0.5, unit: "px" },
                          lineHeight: 1.5,
                      }
                    : `{text.t${i - 1}}`,
        };
    }
    return { color: colors, space, text };
}

function colorOverrides(seed: number, perGroup: number): Tree {
    const colors: Tree = {};
    for (let i = 0; i < perGroup; i += 3)
        colors[`c${i}`] = { $type: "color", $value: color(seed + i) };
    return { color: colors };
}

function spaceOverrides(scale: number, perGroup: number): Tree {
    const space: Tree = {};
    for (let i = 0; i < perGroup; i += 2) {
        space[`s${i}`] = {
            $type: "dimension",
            $value: { value: (1 + (i % 5)) * scale, unit: "rem" },
        };
    }
    return { space };
}

export function permutationsProject(perGroup: number): Record<string, string> {
    const contexts = (names: string[], override: (index: number) => Tree) =>
        Object.fromEntries(names.map((name, i) => [name, i === 0 ? [] : [override(i)]]));
    const resolver = {
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
            {
                type: "modifier",
                name: "theme",
                default: "light",
                contexts: contexts(["light", "dark", "dim", "sepia"], (i) =>
                    colorOverrides(i, perGroup),
                ),
            },
            {
                type: "modifier",
                name: "density",
                default: "regular",
                contexts: contexts(["regular", "compact", "spacious"], (i) =>
                    spaceOverrides(i === 1 ? 0.75 : 1.25, perGroup),
                ),
            },
            {
                type: "modifier",
                name: "contrast",
                default: "standard",
                contexts: contexts(["standard", "high"], () => colorOverrides(99, perGroup)),
            },
        ],
    };
    return {
        "tokens.resolver.json": JSON.stringify(resolver),
        "base.json": JSON.stringify(tokens(perGroup)),
    };
}

export function extendsProject(groups: number, perGroup: number): Record<string, string> {
    const tree: Tree = { base: { $type: "number" } };
    const base = tree.base as Tree;
    for (let i = 0; i < perGroup; i++) base[`t${i}`] = { $value: i };
    for (let g = 0; g < groups; g++) {
        tree[`variant${g}`] = { $extends: "{base}", t0: { $value: g } };
    }
    return { "tokens.json": JSON.stringify(tree) };
}
