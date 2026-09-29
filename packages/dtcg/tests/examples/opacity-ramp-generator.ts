// A tool's own generator. A setting on a group, such as `{ steps: 10 }`, makes the group's
// opacity tokens, from 10% to 100%.
import { read, defineGenerator } from "@sugarcube-sh/dtcg";

const opacityRamp = defineGenerator({
    select: (extensions) =>
        (extensions["com.example.ramp"] as { steps?: number } | undefined)?.steps,
    generate: (_group, steps, api) => {
        if (steps > 20) api.warn("a very long opacity ramp");
        const tokens: Record<string, { $type: "number"; $value: number }> = {};
        for (let i = 1; i <= steps; i++)
            tokens[String(i * 10)] = { $type: "number", $value: i / steps };
        return tokens;
    },
});

await read("tokens.resolver.json", {
    readText: (p) => fetch(p).then((r) => r.text()),
    generators: [opacityRamp],
});
