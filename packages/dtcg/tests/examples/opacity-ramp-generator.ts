// A tool's own generator. An extension on a group, such as `{ steps: 10 }`, makes the group's
// opacity tokens, from 10% to 100%.
import { read, defineGenerator } from "@sugarcube-sh/dtcg";

const opacityRamp = defineGenerator({
    extension: ["com.example.ramp", "steps"],
    messages: {
        "steps-out-of-range": ({ steps }: { steps: unknown }) =>
            `\`steps\` must be a number from 1 to 20, not ${JSON.stringify(steps)}`,
    },
    generate: (_group, steps) => {
        if (typeof steps !== "number" || steps < 1 || steps > 20) {
            return {
                ok: false,
                errors: [{ path: [], reason: "steps-out-of-range", data: { steps } }],
            };
        }
        const tokens = Array.from({ length: steps }, (_, i) => ({
            name: String((i + 1) * 10),
            $type: "number" as const,
            $value: (i + 1) / steps,
        }));
        return { ok: true, value: tokens };
    },
});

await read("tokens.resolver.json", {
    readText: (p) => fetch(p).then((r) => r.text()),
    generators: [opacityRamp],
});
