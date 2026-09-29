// A slider that resizes a whole spacing scale at once. While it moves, the page previews every
// step without touching the files: each frame makes a new project and throws it away. Letting go
// keeps the last one, as one undo step.
import { isAlias, tokensIn, type Document } from "@sugarcube-sh/dtcg";
import { setValues, type Session } from "@sugarcube-sh/dtcg-edit";

declare const session: Session;
declare function showPreview(doc: Document): void;

const steps = tokensIn(session.project.doc, "space").flatMap((t) =>
    t.type === "dimension" && t.resolved && !isAlias(t.value) && !t.generated
        ? [{ path: t.path, size: t.resolved }]
        : [],
);

const resized = (factor: number) =>
    setValues(
        session.project,
        steps.map(({ path, size }) => ({
            path,
            value: { value: Math.round(size.value * factor * 100) / 100, unit: size.unit },
        })),
    );

export function onSliderMove(factor: number): void {
    const preview = session.preview(resized(factor));
    if ("project" in preview) showPreview(preview.project.doc);
}

export function onSliderRelease(factor: number): void {
    session.do(resized(factor));
}
