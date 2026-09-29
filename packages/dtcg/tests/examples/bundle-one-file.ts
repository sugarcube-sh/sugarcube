// Packs a design system spread across many files into one file, e.g. to attach to a bug report.
import { read, toDTCGProject } from "@sugarcube-sh/dtcg";

const doc = await read("tokens.resolver.json", { readText: (p) => fetch(p).then((r) => r.text()) });
const { files, skipped } = toDTCGProject(doc, { single: true });
const [name, bundle] = Object.entries(files)[0] ?? [];
if (name && bundle) download(name, JSON.stringify(bundle, null, 2));
if (skipped.length) showMessage(`Broken tokens left out: ${skipped.join(", ")}`);
