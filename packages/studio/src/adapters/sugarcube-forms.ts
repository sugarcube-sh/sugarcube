import { SUGARCUBE_NAMESPACE } from "@sugarcube-sh/core/client";
import type {
    DesignTokens,
    Group,
    JsonObject,
    JsonValue,
    Token,
    TokenType,
} from "@sugarcube-sh/dtcg";
import { type DefinitionOptions, combine, setExtension, setValue } from "@sugarcube-sh/dtcg-edit";
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

export function getSugarcubeForm(
    tokens: DesignTokens,
    node: Token | Group,
    at?: DefinitionOptions["at"],
): ExtensionForm | undefined {
    if (node.kind === "group") return getScaleForm(tokens, node);
    if (node.generated) return getStepForm(node);
    return at && getFluidForm(tokens, node, at);
}

function getFluidForm(
    tokens: DesignTokens,
    token: Token,
    at: DefinitionOptions["at"],
): ExtensionForm | undefined {
    if (token.type !== "dimension") return undefined;
    const { path } = token;
    const findDefinition = (stepTokens: DesignTokens) =>
        stepTokens.getDefinitions(path).find(({ span }) => span.file === at.file);
    const definitionJson = findDefinition(tokens)?.json;
    const fluid = getSugarcubeSetting(
        isJsonObject(definitionJson) ? definitionJson.$extensions : undefined,
        "fluid",
    );
    if (!fluid) return undefined;
    const getSpan = (stepTokens: DesignTokens) => findDefinition(stepTokens)?.span ?? at;
    return {
        label: "Fluid",
        fields: toFormFields(fluidSettings, fluid),
        write(key, value) {
            const setting = [SUGARCUBE_NAMESPACE, "fluid", key] as const;
            if (key !== "max") return setExtension(tokens, path, setting, value, { at });
            return combine(tokens, [
                (stepTokens) =>
                    setExtension(stepTokens, path, setting, value, { at: getSpan(stepTokens) }),
                (stepTokens) => setValue(stepTokens, path, value, { at: getSpan(stepTokens) }),
            ]);
        },
    };
}

function getStepForm(token: Token): ExtensionForm | undefined {
    const fluid =
        token.type === "dimension" ? getSugarcubeSetting(token.extensions, "fluid") : undefined;
    return fluid && { label: "Fluid", fields: toFormFields(fluidSettings, fluid) };
}

function getScaleForm(tokens: DesignTokens, group: Group): ExtensionForm | undefined {
    const scale = getSugarcubeSetting(group.extensions, "scale");
    const settings = scale && getScaleSettings(scale);
    if (!scale || !settings) return undefined;
    return {
        label: "Scale",
        fields: toFormFields(settings, scale),
        write: (key, value) =>
            setExtension(
                tokens,
                group.path,
                [SUGARCUBE_NAMESPACE, "scale", ...key.split(".")],
                value,
            ),
    };
}

function getScaleSettings(scale: Record<string, unknown>): readonly Setting[] | undefined {
    if (scale.mode === "exponential") return exponentialSettings;
    if (scale.mode !== "multipliers") return undefined;
    const names = isJsonObject(scale.multipliers) ? Object.keys(scale.multipliers) : [];
    return [
        ...baseSettings,
        ...names.map((name): Setting => [`multipliers.${name}`, name, "number"]),
        ...(Object.hasOwn(scale, "pairs") ? [["pairs", "Pairs", undefined] as const] : []),
    ];
}

function getSugarcubeSetting(
    extensions: JsonValue | undefined,
    name: string,
): JsonObject | undefined {
    const settings = isJsonObject(extensions) ? extensions[SUGARCUBE_NAMESPACE] : undefined;
    const setting = isJsonObject(settings) ? settings[name] : undefined;
    return isJsonObject(setting) ? setting : undefined;
}

function toFormFields(settings: readonly Setting[], from: JsonObject): FormField[] {
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
