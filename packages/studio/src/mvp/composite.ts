export type CompositeField = {
    key: string;
    label: string;
    type: string;
    optional?: boolean;
};

const COMPOSITES: Record<string, readonly CompositeField[]> = {
    border: [
        { key: "color", label: "Colour", type: "color" },
        { key: "width", label: "Width", type: "dimension" },
        { key: "style", label: "Style", type: "strokeStyle" },
    ],
    transition: [
        { key: "duration", label: "Duration", type: "duration" },
        { key: "delay", label: "Delay", type: "duration" },
        { key: "timingFunction", label: "Timing function", type: "cubicBezier" },
    ],
    typography: [
        { key: "fontFamily", label: "Font family", type: "fontFamily" },
        { key: "fontSize", label: "Font size", type: "dimension" },
        { key: "fontWeight", label: "Font weight", type: "fontWeight", optional: true },
        { key: "letterSpacing", label: "Letter spacing", type: "dimension", optional: true },
        { key: "lineHeight", label: "Line height", type: "number", optional: true },
    ],
};

/** The types that have a table here, composite and layered. */
export function compositeTypes(): readonly string[] {
    return [...Object.keys(COMPOSITES), ...Object.keys(LAYERED)];
}

export function compositeFields(type: string | undefined, value: unknown): CompositeField[] {
    if (type === undefined) return [];
    const fields = COMPOSITES[type];
    if (!fields) return [];
    if (typeof value !== "object" || value === null || Array.isArray(value)) return [];

    return fields.filter((field) => !field.optional || field.key in value);
}

export function compositePart(value: unknown, key: string): unknown {
    return (value as Record<string, unknown>)[key];
}

export function writeCompositeField(value: unknown, key: string, next: unknown): unknown {
    return { ...(value as Record<string, unknown>), [key]: next };
}

type Layered = {
    fields: readonly CompositeField[];
    allowsSingle: boolean;
    one: string;
    many: string;
};

const PX = { value: 0, unit: "px" };

/** An empty value for each part type a composite can hold. */
const EMPTY_PART_BY_TYPE: Record<string, unknown> = {
    color: "",
    dimension: PX,
    duration: { value: 0, unit: "ms" },
    cubicBezier: [0, 0, 1, 1],
    fontFamily: "",
    fontWeight: 400,
    number: 0,
    strokeStyle: "solid",
};

/** A composite with its required parts empty, or undefined for a type with no table. */
export function emptyComposite(type: string): unknown {
    const fields = COMPOSITES[type];
    if (!fields) return undefined;
    const value: Record<string, unknown> = {};
    for (const field of fields) {
        if (!field.optional) value[field.key] = EMPTY_PART_BY_TYPE[field.type] ?? "";
    }
    return value;
}

const LAYERED: Record<string, Layered> = {
    shadow: {
        fields: [
            { key: "color", label: "Colour", type: "color" },
            { key: "offsetX", label: "Offset X", type: "dimension" },
            { key: "offsetY", label: "Offset Y", type: "dimension" },
            { key: "blur", label: "Blur", type: "dimension" },
            { key: "spread", label: "Spread", type: "dimension" },
        ],
        allowsSingle: true,
        one: "shadow",
        many: "shadows",
    },
    gradient: {
        fields: [
            { key: "color", label: "Colour", type: "color" },
            { key: "position", label: "Position", type: "number" },
        ],
        allowsSingle: false,
        one: "stop",
        many: "stops",
    },
};

const EMPTY_PART: Record<string, unknown> = {
    color: "",
    offsetX: PX,
    offsetY: PX,
    blur: PX,
    spread: PX,
    position: 0,
};

export function layerFields(type: string | undefined): CompositeField[] {
    return type === undefined ? [] : [...(LAYERED[type]?.fields ?? [])];
}

export function layerNoun(type: string | undefined, count: number): string {
    const layered = type === undefined ? undefined : LAYERED[type];
    if (!layered) return "";
    return count === 1 ? layered.one : layered.many;
}

function isLayer(value: unknown): boolean {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readLayers(type: string | undefined, value: unknown): unknown[] | undefined {
    const layered = type === undefined ? undefined : LAYERED[type];
    if (!layered) return undefined;

    if (Array.isArray(value)) return value.every(isLayer) ? [...value] : undefined;
    return layered.allowsSingle && isLayer(value) ? [value] : undefined;
}

export function writeLayers(type: string, previous: unknown, layers: unknown[]): unknown {
    const layered = LAYERED[type];
    if (layered?.allowsSingle && !Array.isArray(previous) && layers.length === 1) return layers[0];
    return layers;
}

/** The layers a new token of a layered type starts with: one, or the two stops a gradient needs. */
export function emptyLayers(type: string): unknown[] | undefined {
    const layered = LAYERED[type];
    if (!layered) return undefined;
    if (type === "gradient")
        return [emptyLayer(type), { ...(emptyLayer(type) as object), position: 1 }];
    return [emptyLayer(type)];
}

export function emptyLayer(type: string): unknown {
    const layer: Record<string, unknown> = {};
    for (const field of LAYERED[type]?.fields ?? []) layer[field.key] = EMPTY_PART[field.key] ?? "";
    return layer;
}
