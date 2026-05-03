/** Slot types for the cascade scale store. */

import type { ScaleBinding } from "@sugarcube-sh/core/client";

/**
 * A hardcoded-scale binding (cascade UI). The "captured" baseline values
 * (baseMax, multipliers, etc.) are *derived* from the live baseline on
 * demand — never captured at mount. The slot owns only the user's
 * pending slider state, plus a reference to its binding for derivation.
 */
export type ScaleSlot = {
    binding: ScaleBinding;
    edits: { base: number; spread: number } | null;
};

export type LinkSlot = {
    bindingToken: string;
    sourceBinding: string;
    edits: { enabled: boolean } | null;
};
