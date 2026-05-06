import type { ScaleBinding } from "@sugarcube-sh/core/client";

export type ScaleSlot = {
    binding: ScaleBinding;
    edits: { base: number; spread: number } | null;
};

export type LinkSlot = {
    bindingToken: string;
    sourceBinding: string;
    edits: { enabled: boolean } | null;
};
