"use client";

import { useGroupRows } from "../inspector/use-editor-rows";
import { FieldRenderer } from "../rows/FieldRenderer";

export function RecipeEditor({ path }: { path: string }) {
    const rows = useGroupRows(path);
    if (rows.length === 0) return null;

    return (
        <section className="recipe-strip" aria-label="Recipe">
            {rows.map((row) => (
                <FieldRenderer key={row.key} row={row} />
            ))}
        </section>
    );
}
