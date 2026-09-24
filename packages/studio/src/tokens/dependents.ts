import type { PathIndex } from "./path-index";
import { unwrapRef } from "./paths";
import type { TokenReader } from "./types";

export function dependentPaths(
    target: string,
    read: TokenReader,
    pathIndex: PathIndex,
    context?: string,
): string[] {
    const prefix = `${target}.`;
    const found: string[] = [];

    for (const [path] of pathIndex.entries()) {
        if (path === target || path.startsWith(prefix)) continue;

        const ref = unwrapRef(read(path, context));
        if (!ref) continue;
        if (ref === target || ref.startsWith(prefix)) found.push(path);
    }

    return found;
}
