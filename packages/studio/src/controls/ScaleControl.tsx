import type { ScaleBinding } from "@sugarcube-sh/core/client";
import { ScalePreview } from "./ScalePreview";

type ScaleControlProps = {
    binding: ScaleBinding;
};

/**
 * Phase 5 ships a single read-only render path for all `type: "scale"`
 * bindings — recipe-authored or hardcoded. Interactive controls land
 * in a follow-up commit during the studio styling pass.
 */
export function ScaleControl({ binding }: ScaleControlProps) {
    return <ScalePreview binding={binding} />;
}
