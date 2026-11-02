// A dev server serving a token editor. The editor needs the files' text as well as the tokens, and
// the design tokens keep both.
import { read } from "@sugarcube-sh/dtcg/node";

const tokens = await read("tokens/tokens.resolver.json");
row(tokens.files.length, tokens.getText(tokens.entryFile)?.length, tokens.diagnostics.length);
