import { SUGARCUBE_NAMESPACE } from "@sugarcube-sh/core/client";
import type {
    DesignTokens,
    Group,
    JsonObject,
    JsonValue,
    Token,
    TokenType,
} from "@sugarcube-sh/dtcg";
import { type PlaceAt, combine, setExtension, setValue } from "@sugarcube-sh/dtcg-edit";
import { isJsonObject } from "@sugarcube-sh/dtcg/values";
import type { ExtensionForm, FormField } from "../controllers/adapter";

type Setting = readonly [key: string, label: string, type: TokenType | undefined];

const fluidSettings: readonly Setting[] = [
    ["min", "From", "dimension"],
    ["max", "To", "dimension"],
];

const baseSettings: readonly Setting[] = [
    ["base.min", "Base from", "dimension"],
    ["base.max", "Base to", "dimension"],
];

const exponentialSettings: readonly Setting[] = [
    ...baseSettings,
    ["ratio.min", "Ratio from", "number"],
    ["ratio.max", "Ratio to", "number"],
    ["steps.negative", "Steps below", "number"],
    ["steps.positive", "Steps above", "number"],
];

export function sugarcubeForm(
    tokens: DesignTokens,
    node: Token | Group,
    at?: PlaceAt["at"],
): ExtensionForm | undefined {
    if (node.kind === "group") return scaleForm(tokens, node);
    if (node.generated) return stepForm(node);
    return at && fluidForm(tokens, node, at);
}

function fluidForm(
    tokens: DesignTokens,
    token: Token,
    at: PlaceAt["at"],
): ExtensionForm | undefined {
    if (token.type !== "dimension") return undefined;
    const { path } = token;
    const placeIn = (now: DesignTokens) =>
        now.writtenAt(path).find(({ span }) => span.file === at.file);
    const written = placeIn(tokens)?.written;
    const fluid = sugarcubeSetting(
        isJsonObject(written) ? written.$extensions : undefined,
        "fluid",
    );
    if (!fluid) return undefined;
    const atIn = (now: DesignTokens) => placeIn(now)?.span ?? at;
    return {
        label: "Fluid",
        fields: fieldsOf(fluidSettings, fluid),
        write(key, value) {
            const setting = [SUGARCUBE_NAMESPACE, "fluid", key] as const;
            if (key !== "max") return setExtension(tokens, path, setting, value, { at });
            return combine(tokens, [
                (now) => setExtension(now, path, setting, value, { at: atIn(now) }),
                (now) => setValue(now, path, value, { at: atIn(now) }),
            ]);
        },
    };
}

function stepForm(token: Token): ExtensionForm | undefined {
    const fluid =
        token.type === "dimension" ? sugarcubeSetting(token.extensions, "fluid") : undefined;
    return fluid && { label: "Fluid", fields: fieldsOf(fluidSettings, fluid) };
}

function scaleForm(tokens: DesignTokens, group: Group): ExtensionForm | undefined {
    const scale = sugarcubeSetting(group.extensions, "scale");
    const settings = scale && scaleSettings(scale);
    if (!scale || !settings) return undefined;
    return {
        label: "Scale",
        fields: fieldsOf(settings, scale),
        write: (key, value) =>
            setExtension(
                tokens,
                group.path,
                [SUGARCUBE_NAMESPACE, "scale", ...key.split(".")],
                value,
            ),
    };
}

function scaleSettings(scale: Record<string, unknown>): readonly Setting[] | undefined {
    if (scale.mode === "exponential") return exponentialSettings;
    if (scale.mode !== "multipliers") return undefined;
    const names = isJsonObject(scale.multipliers) ? Object.keys(scale.multipliers) : [];
    return [
        ...baseSettings,
        ...names.map((name): Setting => [`multipliers.${name}`, name, "number"]),
        ...(Object.hasOwn(scale, "pairs") ? [["pairs", "Pairs", undefined] as const] : []),
    ];
}

function sugarcubeSetting(extensions: JsonValue | undefined, name: string): JsonObject | undefined {
    const settings = isJsonObject(extensions) ? extensions[SUGARCUBE_NAMESPACE] : undefined;
    const found = isJsonObject(settings) ? settings[name] : undefined;
    return isJsonObject(found) ? found : undefined;
}

function fieldsOf(settings: readonly Setting[], from: JsonObject): FormField[] {
    return settings.map(([key, label, type]) => ({
        key,
        label,
        type,
        value: key
            .split(".")
            .reduce<JsonValue | undefined>(
                (value, step) => (isJsonObject(value) ? value[step] : undefined),
                from,
            ),
    }));
}
