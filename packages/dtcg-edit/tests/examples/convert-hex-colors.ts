// A script that rewrites every color written as a hex string into the spec's object form, as one
// step, using the fix offered for each one.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { commit, fix, getFixes } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;

const fixes = tokens.diagnostics
    .filter((d) => d.kind === "hex-string-color")
    .flatMap((d) => getFixes(tokens, d).filter((f) => f.isSafe));

const done = commit(tokens, fix(tokens, fixes));
if (done.tokens) tokens = done.tokens;
else if (done.refusal) showMessage(done.refusal.reason);
