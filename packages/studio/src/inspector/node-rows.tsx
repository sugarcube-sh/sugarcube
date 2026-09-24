import {
    STROKE_STYLE_KEYWORDS,
    type ResolvedToken,
    type ResolvedTokens,
} from "@sugarcube-sh/core/client";
import { Swatch, SwatchGroup, representativeShade } from "../components/controls/Swatch";
import {
    aliasAdapter,
    colorAdapter,
    dimensionAdapter,
    fontFamilyAdapter,
    fontWeightAdapter,
    literalColorAdapter,
    numberAdapter,
    strokeStyleAdapter,
} from "../rows/adapters/token";
import { swapAdapter } from "../rows/adapters/swap";
import {
    colorControl,
    literalColorControl,
    numberControl,
    pickerControl,
    textControl,
} from "../rows/control";
import { scaleRows } from "../rows/scale-rows";
import type { Row } from "../rows/types";
import { cssColorFor } from "../tokens/color-value";
import { cssLengthFor } from "../tokens/dimension";
import { fontWeightOptions, readFontWeight } from "../tokens/font-weight";
import type { PathIndex } from "../tokens/path-index";
import { documentRamps } from "../tokens/palettes";
import { parentPath, stepLabel, unwrapRef } from "../tokens/paths";
import { isAlias } from "../tokens/sections";
import { swapRowFor } from "../tokens/swap";
import type { TokenSnapshot } from "../tokens/types";

export type NodeRowsContext = {
    pathIndex: PathIndex;
    resolved: ResolvedTokens;
    context: string;
};

export type GroupRowsContext = NodeRowsContext & {
    baseline: TokenSnapshot;
    scaleBase?: string;
};

export function rowsForGroup(path: string, ctx: GroupRowsContext): Row[] {
    return [...scaleRowsForGroup(path, ctx), ...swapRows(path, ctx)];
}

function scaleRowsForGroup(path: string, ctx: GroupRowsContext): Row[] {
    return scaleRows(
        { type: "scale", token: `${path}.*` },
        {
            baseline: ctx.baseline,
            pathIndex: ctx.pathIndex,
            context: ctx.context,
            resolved: ctx.resolved,
            colorScale: undefined,
        },
        ctx.scaleBase,
    );
}

function swapRows(path: string, ctx: GroupRowsContext): Row[] {
    const readBaseline = (p: string, context?: string) =>
        ctx.pathIndex.readValue(ctx.baseline.resolved, p, context);
    const readType = (p: string, context?: string) =>
        ctx.pathIndex.readToken(ctx.baseline.resolved, p, context)?.$type;

    // Built from the baseline so the row cannot change under an edit: a
    // FieldRenderer row must keep the same controls for its whole life.
    const row = swapRowFor(path, readBaseline, readType, ctx.pathIndex, ctx.pathIndex.contexts);
    if (!row) return [];

    return [
        {
            key: `${path}#swap:${row.current}`,
            // The same words a single alias uses, and true for the same reason:
            // every reference in this group lands in one ramp, so the group really
            // does point somewhere and you are choosing where.
            label: "Points at",
            controls: [
                pickerControl(
                    {
                        options: row.candidates.map((value) => ({ value })),
                        searchable: row.candidates.length > 8,
                        placeholder: "Mixed",
                        renderItem: (option) => (
                            <>
                                <SwatchGroup shades={shadesOf(option.value, row.shades, ctx)} />
                                <span>{option.value}</span>
                            </>
                        ),
                        renderValue: (option) => (
                            <>
                                <Swatch
                                    color={representativeShade(
                                        shadesOf(option.value, row.shades, ctx),
                                    )}
                                />
                                <span>{option.value}</span>
                            </>
                        ),
                    },
                    swapAdapter(path, row.current),
                ),
            ],
        },
    ];
}

function shadesOf(
    group: string,
    shades: readonly string[],
    ctx: NodeRowsContext,
): (string | undefined)[] {
    return shades.map((shade) =>
        cssColorFor(`${group}.${shade}`, (p) =>
            ctx.pathIndex.readValue(ctx.resolved, p, ctx.context),
        ),
    );
}

export function rowsForToken(token: ResolvedToken, ctx: NodeRowsContext): Row[] {
    const path = token.$path;

    if (isAlias(token)) {
        const control =
            token.$type === "color"
                ? colorControl({ ramps: documentRamps(ctx) }, colorAdapter(path))
                : pickerControl(
                      {
                          options: aliasOptions(token, ctx),
                          searchable: true,
                          renderItem: (option) => (
                              <>
                                  <span className="picker-item-step">{option.label}</span>
                                  {option.detail ? (
                                      <span className="picker-item-length">{option.detail}</span>
                                  ) : null}
                              </>
                          ),
                          renderValue: (option) => <>{option.value}</>,
                      },
                      aliasAdapter(path),
                  );

        return [{ key: `${path}#alias`, label: "Points at", controls: [control] }];
    }

    switch (token.$type) {
        case "dimension":
        case "duration":
            return [
                {
                    key: `${path}#dimension`,
                    label: "Value",
                    controls: [
                        numberControl(
                            { step: 0.0625, unit: unitOf(token) },
                            dimensionAdapter(path),
                        ),
                    ],
                },
            ];

        case "number":
            return [
                {
                    key: `${path}#number`,
                    label: "Value",
                    controls: [numberControl({ step: 0.1 }, numberAdapter(path))],
                },
            ];

        case "color":
            return [
                {
                    key: `${path}#literal-color`,
                    label: "Value",
                    controls: [literalColorControl({}, literalColorAdapter(path))],
                },
            ];

        case "fontWeight":
            return [
                {
                    key: `${path}#font-weight`,
                    label: "Value",
                    controls: [
                        pickerControl(
                            {
                                options: fontWeightOptions(readFontWeight(token.$value)?.weight),
                                renderItem: (option) => (
                                    <>
                                        <span className="picker-item-step">{option.label}</span>
                                        <span className="picker-item-length">{option.detail}</span>
                                    </>
                                ),
                                renderValue: (option) => <>{option.label}</>,
                            },
                            fontWeightAdapter(path),
                        ),
                    ],
                },
            ];

        case "strokeStyle":
            return [
                {
                    key: `${path}#stroke-style`,
                    label: "Value",
                    controls: [
                        pickerControl(
                            {
                                options: STROKE_STYLE_KEYWORDS.map((value) => ({ value })),
                                placeholder: "Dash array",
                            },
                            strokeStyleAdapter(path),
                        ),
                    ],
                },
            ];

        case "fontFamily":
            return [
                {
                    key: `${path}#font-family`,
                    label: "Value",
                    controls: [
                        textControl(
                            { placeholder: "Inter, system-ui, sans-serif" },
                            fontFamilyAdapter(path),
                        ),
                    ],
                },
            ];

        default:
            return [];
    }
}

function unitOf(token: ResolvedToken): string | undefined {
    const raw = token.$value;
    if (raw && typeof raw === "object" && "unit" in raw) {
        const unit = (raw as { unit: unknown }).unit;
        if (typeof unit === "string") return unit;
    }
    return undefined;
}

export type AliasOption = {
    value: string;
    label: string;
    group: string;
    /** The size this resolves to, where it has one, so the choice can be seen. */
    detail?: string;
};

/**
 * The other steps of the scale this token already uses.
 *
 * `heading.1` points at `{text.4xl}`, so it offers the rest of `text` — not
 * every `dimension` in the document. `$type` does not separate a font size from
 * a corner radius, and nothing else does either, so an unfiltered list offered
 * to point a heading at a border radius. Both are `dimension`, both carry
 * `xl`/`2xl`/`3xl`, and neither is an alternative to the other.
 *
 * Moving a token to a different scale is a deliberate change to how the system
 * is put together — a new step in the scale it is on, or an edit to the file —
 * rather than something to fall into from a dropdown. There is no way out of
 * the current scale from here yet, and that is known.
 */
export function aliasOptions(token: ResolvedToken, ctx: NodeRowsContext): AliasOption[] {
    const read = (path: string) => ctx.pathIndex.readValue(ctx.resolved, path, ctx.context);
    const scale = parentPath(unwrapRef(token.$value) ?? "");
    if (!scale) return [];

    const options: AliasOption[] = [];
    for (const path of ctx.pathIndex.under(scale)) {
        if (path === token.$path) continue;
        if (parentPath(path) !== scale) continue;

        const candidate = ctx.pathIndex.readToken(ctx.resolved, path, ctx.context);
        if (!candidate || candidate.$type !== token.$type) continue;

        options.push({
            value: path,
            label: stepLabel(path),
            group: scale,
            detail: cssLengthFor(path, read),
        });
    }

    return options;
}
