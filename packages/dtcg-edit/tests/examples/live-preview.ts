// A token editor next to a live page. Every edit sends the page fresh CSS, so the page restyles as
// you type. If edits arrive faster than the CSS can be built, only the newest is sent. Typing in
// one field is one step, undone as one.
import type { DesignTokens } from "@sugarcube-sh/dtcg";
import { setValue, type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;
declare function buildCSS(tokens: DesignTokens): Promise<string>;
declare function sendToPage(css: string): void;

let latest = 0;

session.subscribe(async () => {
    const run = ++latest;
    const css = await buildCSS(session.tokens);
    if (run === latest) sendToPage(css);
});

export function onType(path: string, text: string): void {
    session.do(setValue(session.tokens, path, text), { merge: `value ${path}` });
}
