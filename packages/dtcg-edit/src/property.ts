import type { DesignTokens, JsonValue } from "@sugarcube-sh/dtcg";
import { opsAt } from "./file-text.js";
import type { OpResult } from "./index.js";
import { asked, copiesOf, propertyPlace } from "./placement.js";

export function propertyEdit(
    tokens: DesignTokens,
    path: string,
    key: "$description" | "$deprecated",
    value: JsonValue | null,
    place?: string,
): OpResult {
    const copies = copiesOf(tokens, path);
    if ("refused" in copies) return copies;
    if (copies.of === "token") {
        const ops = copies.places.flatMap((at) => opsAt(tokens, at, [key], value));
        return { ops, alsoAffects: copies.alsoAffects, moved: [] };
    }
    const placed = propertyPlace(tokens, path, key, copies.places, place);
    if ("choose" in placed) {
        return asked(placed.choose, (file) => propertyEdit(tokens, path, key, value, file));
    }
    if ("refused" in placed) return placed;
    const ops = opsAt(tokens, placed.at, [key], value);
    return { ops, alsoAffects: placed.alsoAffects, moved: [] };
}
