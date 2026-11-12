// A slider that resizes a whole spacing scale at once, in every theme that writes a step. While it
// moves, the page previews every step without touching the files: each frame makes new design
// tokens and throws them away. Letting go keeps the last one, as one undo step.
import { type DesignTokens } from "@sugarcube-sh/dtcg";
import { setValues, type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;
declare function showPreview(tokens: DesignTokens): void;

const tokens = session.tokens;
const steps = (tokens.getPermutation().getGroup("space")?.childTokens ?? []).flatMap(({ path }) =>
    tokens.getDefinitions(path).flatMap(({ span, winningPermutations }) => {
        const there = winningPermutations[0]?.getToken(path);
        return there?.type === "dimension" &&
            there.resolved &&
            !there.getReferenceAt() &&
            !there.generated
            ? [{ path, at: span, size: there.resolved }]
            : [];
    }),
);

const resized = (factor: number) =>
    setValues(
        session.tokens,
        steps.map(({ path, at, size }) => ({
            path,
            at,
            value: { value: Math.round(size.value * factor * 100) / 100, unit: size.unit },
        })),
    );

export function onSliderMove(factor: number): void {
    const preview = session.preview(resized(factor));
    if (preview.tokens) showPreview(preview.tokens);
}

export function onSliderRelease(factor: number): void {
    session.do(resized(factor));
}
