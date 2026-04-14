import type { PanelBinding } from "@sugarcube-sh/core/client";
import { usePathIndex, useScaleState } from "../store/hooks";
import { labelForBinding } from "./resolver";

type ScaleControlProps = {
    binding: PanelBinding;
};

export function ScaleControl({ binding }: ScaleControlProps) {
    const parent = stripTrailingGlob(binding.token);
    const pathIndex = usePathIndex();
    const scaleExt = pathIndex.getScaleExtension(parent);

    if (scaleExt) {
        console.warn(
            `[studio] scale extension found at "${parent}" but Model B controls are not yet implemented; falling through to cascade`
        );
    }

    return <CascadeScaleControl binding={binding} />;
}

function stripTrailingGlob(path: string): string {
    let result = path;
    while (result.endsWith(".*")) result = result.slice(0, -2);
    return result;
}

type CascadeScaleControlProps = {
    binding: PanelBinding;
};

function CascadeScaleControl({ binding }: CascadeScaleControlProps) {
    const slot = useScaleState((state) => state.scales[binding.token]);
    const setBase = useScaleState((state) => state.setBase);
    const setSpread = useScaleState((state) => state.setSpread);

    if (!slot) return null;

    const { scale, base, spread } = slot;
    const label = labelForBinding(binding);
    const baseLabel = `${label} base`;
    const spreadLabel = `${label} spread`;

    return (
        <>
            <div>
                <span>{baseLabel}</span>
                <input
                    type="range"
                    min={scale.baseMax * 0.75}
                    max={scale.baseMax * 1.5}
                    step={0.025}
                    value={base}
                    onChange={(e) => setBase(binding.token, Number(e.target.value))}
                    aria-label={baseLabel}
                    aria-valuetext={`${base}rem`}
                />
                <span>{base.toFixed(3)}</span>
            </div>
            <div>
                <span>{spreadLabel}</span>
                <input
                    type="range"
                    min={0.4}
                    max={1.6}
                    step={0.01}
                    value={spread}
                    onChange={(e) => setSpread(binding.token, Number(e.target.value))}
                    aria-label={spreadLabel}
                    aria-valuetext={`${spread.toFixed(2)}`}
                />
                <span>{spread.toFixed(2)}</span>
            </div>
        </>
    );
}
