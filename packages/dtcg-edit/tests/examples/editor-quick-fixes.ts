// A code editor offering quick fixes for a token problem under the cursor, as Language Server
// Protocol code actions.
import { type Diagnostic, type DesignTokens } from "@sugarcube-sh/dtcg";
import { getFixes } from "@sugarcube-sh/dtcg-edit";

declare const tokens: DesignTokens;
declare const problem: Diagnostic;
declare function uri(file: string): string;
declare function range(file: string, offset: number, length: number): unknown;
declare function respond(actions: unknown[]): void;

respond(
    getFixes(tokens, problem).map((offered) => {
        const changes: Record<string, { range: unknown; newText: string }[]> = {};
        for (const { file, offset, length, text } of offered.edits) {
            changes[uri(file)] ??= [];
            changes[uri(file)]?.push({ range: range(file, offset, length), newText: text });
        }
        return {
            title: offered.title,
            kind: "quickfix",
            isPreferred: offered.isSafe,
            edit: { changes },
        };
    }),
);
