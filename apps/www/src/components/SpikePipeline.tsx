import {
    type InternalConfig,
    type ResolvedTokens,
    type TokenTree,
    generateCSSVariables,
    processAndConvertTokens,
} from "@sugarcube-sh/core/client";
import { useEffect, useMemo, useState } from "react";
import snapshotData from "../../.sugarcube/tokens-snapshot.json";

/**
 * Spike component for verifying that the in-browser pipeline works against
 * the project's REAL tokens AND that the EDIT loop works end to end:
 *
 *   1. Load real resolved tokens from the snapshot
 *   2. Hold them in mutable React state
 *   3. Mutate one token via a slider
 *   4. Re-run processAndConvertTokens + generateCSSVariables on every change
 *   5. Inject the resulting CSS into a <style> tag
 *   6. Watch a styled div react to the variable change in real time
 *
 * If this works, every primitive the real tweakpane needs is proven:
 * the pipeline runs in the browser, mutations re-render correctly, the
 * output CSS is honest, and the loop is fast enough to feel live.
 */

const snapshot = snapshotData as unknown as {
    formatVersion: number;
    generatedAt: string;
    sourceConfigPath: string;
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

/** The token path we'll mutate. `perm:0` is the light-mode permutation. */
const RADIUS_MD_PATH = "perm:0.radius.md";

/**
 * Immutably update a single token's `$value` and `$resolvedValue` at the
 * given path in a ResolvedTokens object. We update both fields because the
 * pipeline reads `$value` for conversion but downstream code may inspect
 * `$resolvedValue`.
 */
function setTokenValue<TValue>(
    resolved: ResolvedTokens,
    path: string,
    newValue: TValue
): ResolvedTokens {
    const existing = resolved[path];
    if (!existing || !("$value" in existing)) {
        throw new Error(`No token at path "${path}" (or it's a group, not a token)`);
    }
    // Cast: existing has been narrowed to a token (has $value), so the
    // constructed object preserves the token shape with new value fields.
    return {
        ...resolved,
        [path]: {
            ...existing,
            $value: newValue,
            $resolvedValue: newValue,
        } as ResolvedTokens[string],
    };
}

export function SpikePipeline() {
    // The current radius value in rem. Defaults to whatever the snapshot
    // shipped with (the project's actual `radius.md`).
    const initialRadiusRem = useMemo(() => {
        const token = snapshot.resolved[RADIUS_MD_PATH];
        if (!token || !("$value" in token)) return 0.25;
        const val = token.$value as { value: number; unit: string };
        return val.value;
    }, []);

    const [radiusRem, setRadiusRem] = useState(initialRadiusRem);
    const [css, setCss] = useState<string | null>(null);
    const [pipelineMs, setPipelineMs] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function runPipeline() {
            try {
                const startedAt = performance.now();

                // Apply the user's edit immutably to the resolved tokens.
                const editedResolved = setTokenValue(snapshot.resolved, RADIUS_MD_PATH, {
                    value: radiusRem,
                    unit: "rem",
                });

                // Run the real pipeline against the edited state.
                const converted = await processAndConvertTokens(
                    snapshot.trees,
                    editedResolved,
                    snapshot.config
                );
                const result = await generateCSSVariables(converted, snapshot.config);

                const ms = performance.now() - startedAt;
                const allCss = result.map((file) => file.css).join("\n\n");

                setCss(allCss);
                setPipelineMs(ms);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));
                setCss(null);
            }
        }

        runPipeline();
    }, [radiusRem]);

    // Compute the diff against the original snapshot for the diff panel.
    const diff = useMemo(() => {
        return radiusRem === initialRadiusRem
            ? []
            : [
                  {
                      path: "radius.md",
                      from: `${initialRadiusRem}rem`,
                      to: `${radiusRem}rem`,
                  },
              ];
    }, [radiusRem, initialRadiusRem]);

    const trees = snapshot.trees.length;
    const resolvedCount = Object.keys(snapshot.resolved).length;
    const permutations = snapshot.config.variables.permutations?.length ?? 0;

    return (
        <div
            style={{
                fontFamily: "ui-monospace, monospace",
                padding: "2rem",
                maxWidth: "80ch",
                margin: "0 auto",
            }}
        >
            <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
                In-browser pipeline spike — EDIT loop
            </h1>

            <p style={{ marginBottom: "1rem" }}>
                Loads real apps/www tokens, runs the sugarcube pipeline in the browser, lets you
                mutate <code>radius.md</code> via the slider, re-runs the pipeline on each change,
                and injects the resulting CSS into the page. The styled box at the bottom uses{" "}
                <code>var(--radius-md)</code> — drag the slider and watch it round.
            </p>

            <label
                style={{
                    display: "block",
                    marginBottom: "1.5rem",
                    padding: "1rem",
                    background: "#fafafa",
                    border: "1px solid #ddd",
                    borderRadius: "0.25rem",
                    color: "#000",
                }}
            >
                <strong>radius.md:</strong>{" "}
                <code>
                    {radiusRem.toFixed(3)}rem
                    {radiusRem !== initialRadiusRem && (
                        <span style={{ color: "#888" }}> (was {initialRadiusRem}rem)</span>
                    )}
                </code>
                <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.0625"
                    value={radiusRem}
                    onChange={(e) => setRadiusRem(Number.parseFloat(e.target.value))}
                    style={{ width: "100%", marginTop: "0.5rem" }}
                />
                <button
                    type="button"
                    onClick={() => setRadiusRem(initialRadiusRem)}
                    disabled={radiusRem === initialRadiusRem}
                    style={{
                        marginTop: "0.5rem",
                        padding: "0.25rem 0.75rem",
                        fontSize: "0.85rem",
                    }}
                >
                    Reset
                </button>
            </label>

            <div
                style={{
                    background: "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "0.25rem",
                    padding: "1rem",
                    marginBottom: "1.5rem",
                    fontSize: "0.85rem",
                    color: "#000",
                }}
            >
                <strong>Snapshot stats:</strong>
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                    <li>Trees: {trees}</li>
                    <li>Resolved tokens: {resolvedCount}</li>
                    <li>Permutations: {permutations}</li>
                    {pipelineMs !== null && (
                        <li>
                            Pipeline run time: <strong>{pipelineMs.toFixed(1)}ms</strong> (in
                            browser, on this edit)
                        </li>
                    )}
                </ul>
            </div>

            <div
                style={{
                    background: "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "0.25rem",
                    padding: "1rem",
                    marginBottom: "1.5rem",
                    fontSize: "0.85rem",
                    color: "#000",
                }}
            >
                <strong>Modified tokens ({diff.length}):</strong>
                {diff.length === 0 ? (
                    <p style={{ marginTop: "0.5rem", color: "#888" }}>
                        No edits yet. Drag the slider above to make a change.
                    </p>
                ) : (
                    <pre
                        style={{
                            marginTop: "0.5rem",
                            background: "#111",
                            color: "#0f0",
                            padding: "0.75rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.8rem",
                        }}
                    >
                        {JSON.stringify(diff, null, 2)}
                    </pre>
                )}
            </div>

            {error && (
                <div
                    style={{
                        background: "#fee",
                        border: "1px solid #c00",
                        padding: "1rem",
                        marginBottom: "1rem",
                        color: "#000",
                    }}
                >
                    <strong>Error:</strong>
                    <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
                </div>
            )}

            {css && (
                <>
                    {/* Inject the generated CSS into the document so the box below can use it. */}
                    <style>{css}</style>

                    <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
                        Live preview using <code>var(--radius-md)</code>
                    </h2>
                    <div
                        style={{
                            background: "#3b82f6",
                            color: "white",
                            padding: "2rem",
                            borderRadius: "var(--radius-md)",
                            textAlign: "center",
                            marginBottom: "1.5rem",
                            transition: "border-radius 80ms ease-out",
                        }}
                    >
                        This box's corner radius is <code>var(--radius-md)</code>. Drag the slider
                        and watch it change.
                    </div>

                    <details>
                        <summary
                            style={{
                                cursor: "pointer",
                                padding: "0.5rem 0",
                                fontWeight: "bold",
                            }}
                        >
                            Show generated CSS ({(css.length / 1024).toFixed(1)} KB)
                        </summary>
                        <pre
                            style={{
                                background: "#111",
                                color: "#0f0",
                                padding: "1rem",
                                overflowX: "auto",
                                fontSize: "0.7rem",
                                marginTop: "0.5rem",
                                maxHeight: "40vh",
                            }}
                        >
                            {css}
                        </pre>
                    </details>
                </>
            )}
        </div>
    );
}
