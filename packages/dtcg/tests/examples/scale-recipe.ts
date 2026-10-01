// A spacing scale made from a recipe on a group, plus a check that the tool's own `$extensions`
// settings are well formed. Both take a schema from any Standard Schema library, such as Zod.
import {
    type StandardSchemaV1,
    defineExtensionValidator,
    defineGenerator,
    read,
} from "@sugarcube-sh/dtcg";

type ScaleRecipe = { mode: "exponential" | "multipliers" };
declare const scaleRecipe: StandardSchemaV1<unknown, ScaleRecipe>;
declare const sugarcubeSettings: StandardSchemaV1<unknown, { fluid?: boolean }>;
declare function expandScale(
    recipe: ScaleRecipe,
): { name: string; $value: unknown; $extensions?: Record<string, unknown> }[];

const scaleRecipes = defineGenerator({
    extension: ["sh.sugarcube", "scale"],
    schema: scaleRecipe,
    generate: (_group, recipe) => ({ ok: true, value: expandScale(recipe) }),
});

const sugarcubeExtensions = defineExtensionValidator({
    key: "sh.sugarcube",
    appliesTo: ["dimension", "group"],
    schema: sugarcubeSettings,
});

await read("tokens.resolver.json", {
    readText: (p) => fetch(p).then((r) => r.text()),
    generators: [scaleRecipes],
    extensionValidators: [sugarcubeExtensions],
});
