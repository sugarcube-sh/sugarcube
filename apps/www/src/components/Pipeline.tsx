import {
    type InternalConfig,
    type ResolvedTokens,
    type TokenTree,
    generateCSSVariables,
    processAndConvertTokens,
} from "@sugarcube-sh/core/client";
import { useEffect, useMemo, useState } from "react";
import snapshotData from "../../.sugarcube/snapshot.json";

const snapshot = snapshotData as unknown as {
    formatVersion: number;
    generatedAt: string;
    sourceConfigPath: string;
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

const RADIUS_MD_PATH = "perm:0.radius.md";

function setTokenValue<TValue>(
    resolved: ResolvedTokens,
    path: string,
    newValue: TValue
): ResolvedTokens {
    const existing = resolved[path];
    if (!existing || !("$value" in existing)) {
        throw new Error(`No token at path "${path}"`);
    }
    return {
        ...resolved,
        [path]: {
            ...existing,
            $value: newValue,
            $resolvedValue: newValue,
        } as ResolvedTokens[string],
    };
}

export function Pipeline() {
    const initialRadiusRem = useMemo(() => {
        const token = snapshot.resolved[RADIUS_MD_PATH];
        if (!token || !("$value" in token)) return 0.25;
        const val = token.$value as { value: number; unit: string };
        return val.value;
    }, []);

    const [radiusRem, setRadiusRem] = useState(initialRadiusRem);
    const [css, setCss] = useState<string | null>(null);
    const [pipelineMs, setPipelineMs] = useState<number | null>(null);

    useEffect(() => {
        async function runPipeline() {
            const startedAt = performance.now();
            const editedResolved = setTokenValue(snapshot.resolved, RADIUS_MD_PATH, {
                value: radiusRem,
                unit: "rem",
            });
            const converted = await processAndConvertTokens(
                snapshot.trees,
                editedResolved,
                snapshot.config
            );
            const result = await generateCSSVariables(converted, snapshot.config);
            setCss(result.map((file) => file.css).join("\n\n"));
            setPipelineMs(performance.now() - startedAt);
        }
        runPipeline();
    }, [radiusRem]);

    const tokenCount = Object.keys(snapshot.resolved).length;

    return (
        <div className="spike-pipeline flow">
            {css && <style>{css}</style>}

            <h1 className="spike-pipeline-headline">
                Oh look, the whole pipeline runs in the browser (and not just Node) now 🚀
            </h1>

            <div className="spike-pipeline-letters">
                {[..."sugarcube.sh"]
                    .map((letter, i) => ({ letter, index: i, key: `${letter}-${i}` }))
                    .map(({ letter, index, key }) => (
                        <div
                            key={key}
                            className="spike-pipeline-letter"
                            data-color={
                                [
                                    "rose",
                                    "orange",
                                    "amber",
                                    "emerald",
                                    "teal",
                                    "cyan",
                                    "blue",
                                    "indigo",
                                    "violet",
                                    "purple",
                                    "fuchsia",
                                    "pink",
                                ][index]
                            }
                        >
                            {letter}
                        </div>
                    ))}
            </div>

            <label className="spike-pipeline-slider">
                <div className="spike-pipeline-slider-header">
                    <span>radius.md</span>
                    <code>{radiusRem.toFixed(3)}rem</code>
                </div>
                <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.0625"
                    value={radiusRem}
                    onChange={(e) => setRadiusRem(Number.parseFloat(e.target.value))}
                />
            </label>

            <div className="spike-pipeline-readout">
                {pipelineMs !== null && (
                    <div className="spike-pipeline-readout-cell">
                        <div className="spike-pipeline-readout-label">pipeline</div>
                        <div className="spike-pipeline-readout-value">
                            {pipelineMs.toFixed(0)}
                            <span className="spike-pipeline-readout-unit">ms</span>
                        </div>
                    </div>
                )}
                <div className="spike-pipeline-readout-cell">
                    <div className="spike-pipeline-readout-label">tokens</div>
                    <div className="spike-pipeline-readout-value">{tokenCount}</div>
                </div>
            </div>

            <p className="spike-pipeline-explainer text-3xl">
                The slider writes a DTCG design token, not a CSS variable! 🤯
            </p>
        </div>
    );
}
