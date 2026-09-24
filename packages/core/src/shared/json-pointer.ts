export type PointerResult =
    | { value: unknown; error?: undefined }
    | { value?: undefined; error: string };

export function resolveJsonPointer(obj: unknown, pointer: string): PointerResult {
    if (pointer === "" || pointer === "/") return { value: obj };

    const segments = pointer
        .slice(1)
        .split("/")
        .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));

    let current: unknown = obj;

    for (const segment of segments) {
        if (current === null || typeof current !== "object") {
            return { error: "cannot navigate into non-object" };
        }

        if (Array.isArray(current)) {
            const index = Number.parseInt(segment, 10);
            if (Number.isNaN(index) || index < 0 || index >= current.length) {
                return { error: `invalid array index "${segment}"` };
            }
            current = current[index];
            continue;
        }

        const record = current as Record<string, unknown>;
        if (!(segment in record)) {
            return { error: `property "${segment}" not found` };
        }
        current = record[segment];
    }

    return { value: current };
}
