// Applies the safe fixes by itself, and asks a person before applying each of the rest. One fix per
// problem, all made from the same design tokens, applied as one step.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { commit, type Fix, fix, getFixes } from "@sugarcube-sh/dtcg-edit";

declare let tokens: DesignTokens;
declare function confirm(question: string): Promise<boolean>;

const chosen: Fix[] = [];
for (const d of tokens.diagnostics.filter((each) => each.severity === "error")) {
    for (const offered of getFixes(tokens, d)) {
        if (offered.isSafe || (await confirm(`${d.message}: ${offered.title}?`))) {
            chosen.push(offered);
            break;
        }
    }
}

const done = commit(tokens, fix(tokens, chosen));
if (done.tokens) tokens = done.tokens;
