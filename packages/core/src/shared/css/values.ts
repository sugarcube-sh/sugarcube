import {
    type Alias,
    type ColorComponent,
    type ColorValue,
    type JsonPath,
    type Pointer,
    type Token,
    type TokenType,
    type TypographyValue,
    type ValueByType,
    referenceAt,
} from "@sugarcube-sh/dtcg";

export interface Written {
    suffix: string;
    value: string;
}

export type VariableFor = (ref: Alias | Pointer) => string | undefined;

interface Writer {
    variableAt(at: JsonPath): string | undefined;
    part<T extends PartType>(at: JsonPath, type: T, value: ValueByType[T]): string;
    unwritable(): void;
}

type PartType = Exclude<TokenType, "typography">;

export function renderToken(token: Token, variableFor: VariableFor): Written[] | undefined {
    if (token.resolved === undefined) return undefined;
    let writable = true;
    const writer: Writer = {
        variableAt: (at) => {
            const ref = referenceAt(token, at);
            return ref && variableFor(ref);
        },
        part: (at, type, value) => {
            const variable = writer.variableAt(at);
            return variable ? `var(${variable})` : renderers[type](value, at, writer);
        },
        unwritable: () => {
            writable = false;
        },
    };
    const written =
        token.type === "typography"
            ? typography(token.resolved, writer)
            : [{ suffix: "", value: writer.part([], token.type, token.resolved) }];
    return writable ? written : undefined;
}

const renderers: {
    [T in PartType]: (value: ValueByType[T], at: JsonPath, writer: Writer) => string;
} = {
    color: (value, _at, writer) => {
        const css = renderColor(value);
        if (css === undefined) writer.unwritable();
        return css ?? "";
    },
    dimension: ({ value, unit }) => `${value}${unit}`,
    duration: ({ value, unit }) => `${value}${unit}`,
    cubicBezier: (points) => `cubic-bezier(${points.join(", ")})`,
    number: (value) => String(value),
    fontFamily: (names) => names.map(quoteFont).join(", "),
    fontWeight: (weight) => String(weight),
    strokeStyle: (style, at, writer) => {
        if (style.kind === "keyword") return style.keyword;
        const dashes = style.dashArray.map((dash, index) =>
            writer.part([...at, "dashArray", index], "dimension", dash),
        );
        return `${dashes.join(" ")} ${style.lineCap}`;
    },
    border: ({ width, style, color }, at, writer) =>
        [
            writer.part([...at, "width"], "dimension", width),
            writer.part([...at, "style"], "strokeStyle", style),
            writer.part([...at, "color"], "color", color),
        ].join(" "),
    transition: ({ duration, timingFunction, delay }, at, writer) =>
        [
            writer.part([...at, "duration"], "duration", duration),
            writer.part([...at, "timingFunction"], "cubicBezier", timingFunction),
            writer.part([...at, "delay"], "duration", delay),
        ].join(" "),
    shadow: (layers, at, writer) =>
        layers
            .map((layer, index) => {
                const place = [...at, index];
                const variable = writer.variableAt(place);
                if (variable) return `var(${variable})`;
                const parts = [
                    writer.part([...place, "offsetX"], "dimension", layer.offsetX),
                    writer.part([...place, "offsetY"], "dimension", layer.offsetY),
                    writer.part([...place, "blur"], "dimension", layer.blur),
                    writer.part([...place, "spread"], "dimension", layer.spread),
                    writer.part([...place, "color"], "color", layer.color),
                ];
                return `${layer.inset ? "inset " : ""}${parts.join(" ")}`;
            })
            .join(", "),
    gradient: (stops, at, writer) => {
        const written = stops.map(({ color, position }, index) => {
            const variable = writer.variableAt([...at, index, "position"]);
            const where = variable
                ? `clamp(0%, var(${variable}) * 100%, 100%)`
                : `${position * 100}%`;
            return `${writer.part([...at, index, "color"], "color", color)} ${where}`;
        });
        return `linear-gradient(${written.join(", ")})`;
    },
};

function typography(value: TypographyValue, writer: Writer): Written[] {
    const whole = writer.variableAt([]);
    const part = <T extends PartType>(
        suffix: string,
        key: keyof TypographyValue,
        type: T,
        of: ValueByType[T],
    ) => ({
        suffix,
        value: whole ? `var(${whole}${suffix})` : writer.part([key], type, of),
    });
    return [
        part("-font-family", "fontFamily", "fontFamily", value.fontFamily),
        part("-font-size", "fontSize", "dimension", value.fontSize),
        part("-font-weight", "fontWeight", "fontWeight", value.fontWeight),
        part("-letter-spacing", "letterSpacing", "dimension", value.letterSpacing),
        part("-line-height", "lineHeight", "number", value.lineHeight),
    ];
}

const GENERIC_FAMILIES = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
]);

function quoteFont(name: string): string {
    if (GENERIC_FAMILIES.has(name.toLowerCase())) return name;
    return /[\s'"!@#$%^&*()=+[\]{};:|\\/,.<>?~]/.test(name) ? `"${name}"` : name;
}

function renderColor({ colorSpace, components, alpha, hex }: ColorValue): string | undefined {
    const [a, b, c] = components;
    switch (colorSpace) {
        case "srgb":
            if (hex !== undefined) return hexOf(hex, alpha);
            return withAlpha(`rgb(${[a, b, c].map(channel).join(" ")}`, alpha);
        case "hsl":
            return withAlpha(`hsl(${fixed(a, 1)} ${percent(b)} ${percent(c)}`, alpha);
        case "oklch":
            return withAlpha(`oklch(${[a, b, c].map((each) => fixed(each, 4)).join(" ")}`, alpha);
        case "display-p3":
            return withAlpha(
                `color(display-p3 ${[a, b, c].map((each) => fixed(each, 4)).join(" ")}`,
                alpha,
            );
        default:
            return undefined;
    }
}

function withAlpha(opened: string, alpha: number): string {
    return alpha === 1 ? `${opened})` : `${opened} / ${fixed(alpha, 4)})`;
}

function channel(component: ColorComponent): string {
    return component === "none" ? "none" : String(Math.round(component * 255));
}

function percent(component: ColorComponent): string {
    return component === "none" ? "none" : `${Math.round(component)}%`;
}

function fixed(component: ColorComponent, digits: number): string {
    return component === "none" ? "none" : String(Number(component.toFixed(digits)));
}

function hexOf(hex: string, alpha: number): string {
    if (alpha === 1) return hex;
    const pair = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, "0");
    return `${hex}${/[A-F]/.test(hex) && !/[a-f]/.test(hex) ? pair.toUpperCase() : pair}`;
}
