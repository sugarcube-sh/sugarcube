// A spacing scale made from a recipe on a group, plus a check that the tool's own `$extensions`
// settings are well formed.
import { read, defineGenerator, type ExtensionValidator } from "@sugarcube-sh/dtcg";

type ScaleRecipe = { mode: "exponential" | "multipliers" };
declare function expandScale(
    recipe: ScaleRecipe,
): Record<string, { $value: unknown; $extensions?: Record<string, unknown> }>;

const scaleRecipes = defineGenerator({
    select: (extensions) =>
        (extensions["sh.sugarcube"] as { scale?: ScaleRecipe } | undefined)?.scale,
    generate: (_group, recipe) => expandScale(recipe),
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
    extensions: [sugarcubeExtensions],
});
