import type { ScaleBinding, ScaleExtension } from "@sugarcube-sh/core/client";

type Dim = { value: number; unit: string };

export type StepOverrides = Record<string, { min: Dim; max: Dim }>;

export type ScaleEdit =
    | { kind: "tokens"; base?: number; spread?: number; overrides?: StepOverrides }
    | { kind: "scale"; scale: ScaleExtension };

export type ScaleEditField = "ratio" | "base" | "spread";

export type LinkEdit = { enabled: boolean };

export type ScaleBindingMeta = {
    binding: ScaleBinding;
    kind: "tokens" | "scale";
    parentPath: string;
    ownedPaths: readonly string[];
    sourcePath: string;
};

export type LinkBindingMeta = {
    bindingToken: string;
    sourceBinding: string;
};
