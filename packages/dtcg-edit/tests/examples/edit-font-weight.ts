// Changes only the font weight of a typography token, leaving its other four properties as written.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { setValue, commit } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const done = commit(tokens, setValue(tokens, "type.heading", 700, { part: ["fontWeight"] }));
if (done.tokens) tokens = done.tokens;
if (done.refusal) showMessage(done.refusal.reason);
