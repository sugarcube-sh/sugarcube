import type { PanelBinding } from "@sugarcube-sh/core/client";
import { lastSegment } from "../tokens/paths";

export function labelForBinding(binding: PanelBinding): string {
    if (binding.label) return binding.label;
    const path = binding.type === "palette-swap" ? binding.family : binding.token;
    return lastSegment(path);
}
