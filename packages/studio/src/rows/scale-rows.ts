import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { selectCapture } from "../store/scale-selectors";
import { stripTrailingGlob } from "../tokens/paths";
import { getScaleExtension } from "../tokens/scale-extension";
import {
    directBaseAdapter,
    directSpreadAdapter,
    scaleBaseAdapter,
    scaleRatioAdapter,
} from "./adapters/scale";
import { numberControl, rangeControl } from "./control";
import type { ResolveContext, Row } from "./types";

const RATIO_MIN = 1;
const RATIO_MAX = 2;
const BASE_MIN = 0.5;
const BASE_MAX = 2;

export function scaleRows(binding: ScaleBinding, ctx: ResolveContext): Row[] {
    const scale = getScaleExtension(ctx.baseline.trees, stripTrailingGlob(binding.token));

    if (scale?.mode === "exponential") {
        return [
            {
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
                        scaleRatioAdapter(binding.token),
                    ),
                ],
            },
            {
                key: `${binding.token}:base`,
                label: "Base",
                controls: [
                    numberControl(
                        { min: BASE_MIN, max: BASE_MAX, step: 0.025, unit: scale.base.max.unit },
                        scaleBaseAdapter(binding.token),
                    ),
                ],
            },
        ];
    }

    if (scale?.mode === "multipliers") {
        const unit = scale.base.max.unit;
        return [
            {
                key: `${binding.token}:base`,
                label: "Base",
                controls: [
                    rangeControl(
                        {
                            min: BASE_MIN,
                            max: BASE_MAX,
                            step: 0.05,
                            formatValue: (n: number) => `${n}${unit}`,
                        },
                        scaleBaseAdapter(binding.token),
                    ),
                ],
            },
        ];
    }

    const captured = selectCapture(ctx.baseline, ctx.pathIndex, binding, ctx.context);
    if (!captured) return [];

    return [
        {
            key: `${binding.token}:base`,
            label: "Base",
            controls: [
                rangeControl(
                    {
                        min: captured.baseMax * 0.75,
                        max: captured.baseMax * 1.5,
                        step: 0.025,
                        formatValue: (n: number) => `${n}rem`,
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
