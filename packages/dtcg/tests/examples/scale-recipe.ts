// A spacing scale made from a recipe on a group, plus a check that the tool's own `$extensions`
// settings are well formed.
import { read, defineGenerator, type ExtensionValidator } from "@sugarcube-sh/dtcg";

type ScaleRecipe = { mode: "exponential" | "multipliers" };
declare function isScaleRecipe(raw: unknown): raw is ScaleRecipe;
declare function expandScale(
    recipe: ScaleRecipe,
): { name: string; $value: unknown; $extensions?: Record<string, unknown> }[];

const scaleRecipes = defineGenerator({
    extension: ["sh.sugarcube", "scale"],
    generate: (_group, recipe) =>
        isScaleRecipe(recipe)
            ? { ok: true, value: expandScale(recipe) }
            : { ok: false, errors: [{ kind: "invalid-value", path: [], message: "not a recipe" }] },
});

const sugarcubeExtensions: ExtensionValidator = {
    key: "sh.sugarcube",
    appliesTo: ["dimension", "group"],
    validate: (raw, at) =>
        raw && typeof raw === "object"
            ? []
            : [{ kind: "invalid-value", path: at, message: "sh.sugarcube must be an object" }],
};

await read("tokens.resolver.json", {
    readText: (p) => fetch(p).then((r) => r.text()),
    generators: [scaleRecipes],
    extensionValidators: [sugarcubeExtensions],
});
