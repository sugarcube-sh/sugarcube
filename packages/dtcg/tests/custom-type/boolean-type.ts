// A tool adding its own token type, e.g. `boolean`, and reading it back with full types.
import { read, token, defineType } from "@sugarcube-sh/dtcg";

declare module "@sugarcube-sh/dtcg" {
    interface ValueByType {
        boolean: boolean;
    }
}

const booleanType = defineType({
    name: "boolean",
    parse: (raw, at) =>
        typeof raw === "boolean"
            ? { ok: true, value: raw }
            : {
                  ok: false,
                  errors: [{ kind: "invalid-value", path: at, message: "not a boolean" }],
              },
    export: (value) => value,
});

const doc = await read("tokens.resolver.json", {
    readText: (p) => fetch(p).then((r) => r.text()),
    types: [booleanType],
});
const flag = token(doc, "feature.newNav");
if (flag?.type === "boolean" && flag.resolved) showMessage("new nav is on");
