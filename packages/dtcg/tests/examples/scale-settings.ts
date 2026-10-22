// A spacing scale made from settings on a group, plus a check that the tool's own `$extensions`
// settings are well formed. Both take a schema from any Standard Schema library, such as Zod.
import {
    type GeneratedToken,
    type StandardSchemaV1,
    defineExtensionValidator,
    defineGenerator,
    read,
} from "@sugarcube-sh/dtcg";

type ScaleSettings = { mode: "exponential" | "multipliers" };
declare const scaleSettings: StandardSchemaV1<unknown, ScaleSettings>;
declare const toolSettings: StandardSchemaV1<unknown, { fluid?: boolean }>;
declare function expandScale(settings: ScaleSettings): GeneratedToken[];

const scales = defineGenerator({
    extension: ["com.example", "scale"],
    schema: scaleSettings,
    generate: (_group, settings) => ({ ok: true, value: expandScale(settings) }),
});

const toolExtensions = defineExtensionValidator({
    key: "com.example",
    appliesTo: ["dimension", "group"],
    schema: toolSettings,
});

await read("tokens.resolver.json", {
    readText: (p) => fetch(p).then((r) => r.text()),
    generators: [scales],
    extensionValidators: [toolExtensions],
});
