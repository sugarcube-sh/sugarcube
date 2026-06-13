import postcss from "postcss";

export interface VarRef {
    /** The custom-property name, including the leading `--`. */
    name: string;
    /** 1-based line within `file` where the reference appears. */
    line: number;
    file: string;
    /** True for `var(--x, fallback)` — a default is present, so it won't visually break. */
    hasFallback?: boolean;
}

export interface ScanResult {
    /** Custom-property names declared in this CSS, including the leading `--`. */
    declared: Set<string>;
    /** Every `var(--…)` reference found in declaration values. */
    used: VarRef[];
}

// Matches the custom-property name at the start of a `var()` call, plus the
// next significant character so we know whether a fallback follows. Runs per
// declaration value, so `var(--a, var(--b))` yields `--a` (with fallback) and
// `--b` (without).
const VAR_REFERENCE = /var\(\s*(--[\w-]+)\s*([,)])/g;

/**
 * Parse one CSS source and pull out (a) the custom properties it declares and
 * (b) every `var(--…)` it references. A single parse feeds both: declarations
 * become part of the "declared anywhere" set, references are what we later
 * check against it.
 */
export function scanCSS(css: string, file: string): ScanResult {
    const declared = new Set<string>();
    const used: VarRef[] = [];

    postcss.parse(css, { from: file }).walkDecls((decl) => {
        if (decl.prop.startsWith("--")) {
            declared.add(decl.prop);
        }

        const line = decl.source?.start?.line ?? 0;
        for (const match of decl.value.matchAll(VAR_REFERENCE)) {
            const name = match[1];
            if (name) used.push({ name, line, file, hasFallback: match[2] === "," });
        }
    });

    return { declared, used };
}

export interface DanglingReport {
    /** Used, undeclared, and no fallback — resolves to nothing. Hard error. */
    broken: VarRef[];
    /** Used, undeclared, but has a fallback that's doing the job. Informational. */
    masked: VarRef[];
}

/**
 * Split every reference that resolves to no declaration into two tiers:
 * `broken` (no fallback — actually renders to nothing) and `masked` (a fallback
 * is being applied, so it works but the named var doesn't exist). Names whose
 * prefix is in `ignorePrefixes` are dropped entirely — that's the only filter,
 * and it's user-driven (e.g. third-party `--sl-`/`--ec-` vars).
 */
export function findDangling(
    used: VarRef[],
    declared: Set<string>,
    ignorePrefixes: string[]
): DanglingReport {
    const seen = new Set<string>();
    const broken: VarRef[] = [];
    const masked: VarRef[] = [];

    for (const ref of used) {
        if (declared.has(ref.name)) continue;
        if (ignorePrefixes.some((prefix) => ref.name.startsWith(prefix))) continue;

        // De-dupe identical findings (same name on the same line of the same file).
        const key = `${ref.file}:${ref.line}:${ref.name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        (ref.hasFallback ? masked : broken).push(ref);
    }

    return { broken, masked };
}

/**
 * Names that are declared (by sugarcube or the user) but never referenced in a
 * `var(…)` anywhere we scanned. Sorted, prefix-filtered the same way.
 *
 * Caveat: usage is only as complete as the files we scan. In phase 1 (CSS only)
 * a token consumed solely in a component `<style>` block or inline/JS will be
 * reported here even though it's used — so this list over-reports until the
 * usage scan covers those too.
 */
export function findUnused(
    declared: Set<string>,
    used: VarRef[],
    ignorePrefixes: string[]
): string[] {
    const usedNames = new Set(used.map((ref) => ref.name));
    return [...declared]
        .filter((name) => !usedNames.has(name))
        .filter((name) => !ignorePrefixes.some((prefix) => name.startsWith(prefix)))
        .sort();
}
