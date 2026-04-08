import {
    type ConvertedToken,
    type InternalConfig,
    type NormalizedConvertedTokens,
    fillDefaultsCore,
    generateCSSVariables,
} from "@sugarcube-sh/core/client";
import { useEffect, useState } from "react";

/**
 * Spike component for verifying that the in-browser pipeline works.
 *
 * Hand-builds a minimal NormalizedConvertedTokens, runs it through
 * generateCSSVariables, and renders the resulting CSS plus a visual
 * preview that consumes the generated variables.
 *
 * If this works in the browser, the foundation is solid and we can
 * proceed to refactor the tweakpane to use the same code path.
 */
export function SpikePipeline() {
    const [css, setCss] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [primaryColor, setPrimaryColor] = useState("#3b82f6");

    useEffect(() => {
        async function runPipeline() {
            try {
                // Hand-build a single converted color token.
                const colorPrimary: ConvertedToken = {
                    $type: "color",
                    $value: primaryColor,
                    $path: "color.primary",
                    $source: { sourcePath: "spike.json" },
                    $originalPath: "color.primary",
                    $resolvedValue: primaryColor,
                    $cssProperties: { value: primaryColor },
                };

                const tokens: NormalizedConvertedTokens = {
                    "perm:0": {
                        "color.primary": colorPrimary,
                    },
                };

                // Build a config via fillDefaultsCore (no Node fs detection),
                // then attach a default permutation so generate has somewhere
                // to write the variables.
                const baseConfig = fillDefaultsCore(
                    { variables: { path: "tokens.css" } },
                    { stylesDir: "src/styles", componentsDir: "src/components/ui" }
                );

                const config: InternalConfig = {
                    ...baseConfig,
                    variables: {
                        ...baseConfig.variables,
                        permutations: [{ input: {}, selector: ":root" }],
                    },
                };

                const result = await generateCSSVariables(tokens, config);
                const generatedCss = result[0]?.css ?? "";

                setCss(generatedCss);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
                setCss(null);
            }
        }

        runPipeline();
    }, [primaryColor]);

    return (
        <div
            style={{
                fontFamily: "ui-monospace, monospace",
                padding: "2rem",
                maxWidth: "60ch",
                margin: "0 auto",
            }}
        >
            <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>In-browser pipeline spike</h1>

            <p style={{ marginBottom: "1rem" }}>
                This page calls <code>generateCSSVariables</code> from{" "}
                <code>@sugarcube-sh/core/client</code> in the browser, with hand-built input. If you
                can see CSS below and the swatch reflects the picker, the spike succeeded.
            </p>

            <label style={{ display: "block", marginBottom: "1rem" }}>
                Primary color:{" "}
                <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                />{" "}
                <code>{primaryColor}</code>
            </label>

            {error && (
                <div
                    style={{
                        background: "#fee",
                        border: "1px solid #c00",
                        padding: "1rem",
                        marginBottom: "1rem",
                    }}
                >
                    <strong>Error:</strong>
                    <pre style={{ whiteSpace: "pre-wrap" }}>{error}</pre>
                </div>
            )}

            {css && (
                <>
                    {/* Inject the generated CSS into the document so we can use it below */}
                    <style>{css}</style>

                    <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>Generated CSS</h2>
                    <pre
                        style={{
                            background: "#111",
                            color: "#0f0",
                            padding: "1rem",
                            overflowX: "auto",
                            fontSize: "0.85rem",
                            marginBottom: "1.5rem",
                        }}
                    >
                        {css}
                    </pre>

                    <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
                        Live preview using <code>var(--color-primary)</code>
                    </h2>
                    <div
                        style={{
                            background: "var(--color-primary)",
                            color: "white",
                            padding: "2rem",
                            borderRadius: "0.5rem",
                            textAlign: "center",
                        }}
                    >
                        This box uses <code>var(--color-primary)</code>
                    </div>
                </>
            )}
        </div>
    );
}
