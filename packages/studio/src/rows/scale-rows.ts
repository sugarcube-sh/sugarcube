import { type ScaleBinding, roundTo } from "@sugarcube-sh/core/client";
import { selectCapture } from "../store/scale-selectors";
import { cssLengthFor } from "../tokens/dimension";
import { stepLabel, stripTrailingGlob } from "../tokens/paths";
import { getScaleExtension } from "../tokens/scale-extension";
import {
    directBaseAdapter,
    directSpreadAdapter,
    scaleBaseMaxAdapter,
    scaleBaseMinAdapter,
    scaleFromAdapter,
    scaleMultiplierAdapter,
    scaleRatioMaxAdapter,
    scaleRatioMinAdapter,
} from "./adapters/scale";
import { pickerControl, rangeControl } from "./control";
import type { ResolveContext, Row } from "./types";

const RATIO_MIN = 1;
const RATIO_MAX = 2;
const BASE_MIN = 0.5;
const BASE_MAX = 2;

export function scaleRows(binding: ScaleBinding, ctx: ResolveContext, basePath?: string): Row[] {
    const scale = getScaleExtension(ctx.baseline.trees, stripTrailingGlob(binding.token));

    if (scale) {
        const unit = scale.base.max.unit;
        const rows: Row[] = [
            {
                key: `${binding.token}:base`,
                label: "Base",
                controls: [
                    rangeControl(
                        {
                            min: BASE_MIN,
                            max: BASE_MAX,
                            step: 0.025,
                            formatValue: (n: number) => `${n}${unit}`,
                        },
                        scaleBaseMinAdapter(binding.token),
                    ),
                    rangeControl(
                        {
                            min: BASE_MIN,
                            max: BASE_MAX,
                            step: 0.025,
                            formatValue: (n: number) => `${n}${unit}`,
                        },
                        scaleBaseMaxAdapter(binding.token),
                    ),
                ],
            },
        ];

        if (scale.mode === "exponential") {
            rows.unshift({
                key: `${binding.token}:ratio`,
                label: "Ratio",
                controls: [
                    rangeControl(
                        {
                            min: RATIO_MIN,
                            max: RATIO_MAX,
                            step: 0.01,
                            formatValue: (n: number) => n.toFixed(2),
                        },
                        scaleRatioMinAdapter(binding.token),
                    ),
                    rangeControl(
                        {
                            min: RATIO_MIN,
                            max: RATIO_MAX,
                            step: 0.01,
                            formatValue: (n: number) => n.toFixed(2),
                        },
                        scaleRatioMaxAdapter(binding.token),
                    ),
                ],
            });
        }

        if (scale.mode === "multipliers") {
            const largest = Math.max(...Object.values(scale.multipliers), 1);
            for (const name of Object.keys(scale.multipliers)) {
                rows.push({
                    key: `${binding.token}:multiplier:${name}`,
                    label: name,
                    controls: [
                        rangeControl(
                            {
                                min: 0,
                                max: roundTo(largest * 1.5, 2),
                                step: 0.05,
                                formatValue: (n: number) => `×${n}`,
                            },
                            scaleMultiplierAdapter(binding.token, name),
                        ),
                    ],
                });
            }
        }

        return rows;
    }

    const group = stripTrailingGlob(binding.token);
    const steps = ctx.pathIndex
        .matching(binding.token)
        .filter(
            (path) =>
                ctx.pathIndex.readToken(ctx.resolved, path, ctx.context)?.$type === "dimension",
        );

    if (steps.length < 2) return [];

    const scaleFrom: Row = {
        key: `${binding.token}:scale-from`,
        label: "Scale from",
        controls: [
            pickerControl(
                {
                    options: steps.map((path) => ({
                        value: path,
                        label: stepLabel(path),
                        group,
                        detail: cssLengthFor(path, (p) =>
                            ctx.pathIndex.readValue(ctx.resolved, p, ctx.context),
                        ),
                    })),
                    searchable: steps.length > 8,
                    placeholder: "Choose a step",
                },
                scaleFromAdapter(binding.token),
            ),
        ],
    };

    const captured = selectCapture(ctx.baseline, ctx.pathIndex, binding, ctx.context, basePath);
    if (!captured) return [scaleFrom];

    return [
        scaleFrom,
        {
            key: `${binding.token}:base`,
            label: "Base",
            controls: [
                rangeControl(
                    {
                        min: captured.baseMax * 0.5,
                        max: captured.baseMax * 2,
                        step: 0.025,
                        formatValue: (n: number) => `${n}${captured.steps[0]?.unit ?? "rem"}`,
                    },
                    directBaseAdapter(binding.token),
                ),
            ],
        },
        {
            key: `${binding.token}:spread`,
            label: "Spread",
            controls: [
                rangeControl(
                    {
                        min: 0.4,
                        max: 1.6,
                        step: 0.01,
                        formatValue: (n: number) => n.toFixed(2),
                    },
                    directSpreadAdapter(binding.token),
                ),
            ],
        },
    ];
}
