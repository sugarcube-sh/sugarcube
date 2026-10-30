// Reading tokens when the resolver names a file that doesn't exist. Reading still finishes, and the
// missing file is reported as a problem. A file that couldn't be fetched rejects the read instead.
import { read } from "@sugarcube-sh/dtcg";

const tokens = await read("tokens.resolver.json", {
    readText: async (p) => {
        const r = await fetch(p);
        if (r.status === 404) return undefined;
        if (!r.ok) throw new Error(`${p}: ${r.status}`);
        return r.text();
    },
});
for (const missing of tokens.diagnostics.filter((d) => d.kind === "file-not-found"))
    showMessage(missing.message);
