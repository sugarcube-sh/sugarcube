// A text box for a token's value that saves in the file's own spelling: a keyword weight like
// "bold" stays a keyword, and a single font name stays a single string.
import { token, toDTCGValue } from "@sugarcube-sh/dtcg";
import { parseFontFamily, parseFontWeight } from "@sugarcube-sh/dtcg/values";
import { setValue, type Json, type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;

function written(path: string, typed: string): Json | undefined {
    const t = token(session.project.doc, path);
    const like = t?.authored?.value;

    switch (t?.type) {
        case "fontWeight": {
            const parsed = parseFontWeight(/^\d+$/.test(typed) ? Number(typed) : typed, []);
            return parsed.ok ? toDTCGValue("fontWeight", parsed.value, { like }) : undefined;
        }
        case "fontFamily": {
            const names = typed.split(",").map((name) => name.trim());
            const parsed = parseFontFamily(names.filter(Boolean), []);
            return parsed.ok ? toDTCGValue("fontFamily", parsed.value, { like }) : undefined;
        }
        default:
            return undefined;
    }
}

export function save(path: string, typed: string): void {
    const value = written(path, typed);
    if (value === undefined) return;
    const done = session.do(setValue(session.project, path, value));
    if ("refused" in done) showMessage(done.refused.reason);
}
