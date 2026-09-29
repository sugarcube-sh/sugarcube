// A dev server serving a token editor. The editor needs the files' text as well as the tokens, so
// the server opens a project rather than only reading.
import { open } from "@sugarcube-sh/dtcg-edit/node";

const project = await open("tokens/tokens.resolver.json");
row(project.doc.files.length, Object.keys(project.files).length, project.doc.diagnostics.length);
