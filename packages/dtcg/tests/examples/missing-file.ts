// Reading tokens when the resolver names a file that doesn't exist. Reading still finishes, and the
// missing file is reported as a problem.
import { read } from "@sugarcube-sh/dtcg";

const doc = await read("tokens.resolver.json", {
    readText: async (p) => {
        const r = await fetch(p);
        if (!r.ok) throw new Error(`${p}: ${r.status}`);
        return r.text();
    },
});
for (const missing of doc.diagnostics.filter((d) => d.kind === "file-not-found"))
    showMessage(missing.message);
