import { useCallback, useState } from "react";
import { Section } from "../components/Section";
import { applyContainerScale, applySpaceScale, applyTypeScale } from "../scale/applyScale";
import type { ExponentialScaleConfig, MultiplierScaleConfig } from "../scale/calculator";
import {
    DEFAULT_SPACE_SCALE,
    DEFAULT_TYPE_SCALE,
    RATIO_PRESETS,
    type RatioPresetName,
} from "../scale/defaults";

function findClosestPreset(ratio: number): RatioPresetName | null {
    let closest: RatioPresetName | null = null;
    let closestDiff = Number.POSITIVE_INFINITY;
    for (const [name, value] of Object.entries(RATIO_PRESETS)) {
        const diff = Math.abs(value - ratio);
        if (diff < closestDiff) {
            closestDiff = diff;
            closest = name as RatioPresetName;
        }
    }
    return closestDiff < 0.01 ? closest : null;
}

export function ScaleSection() {
    const [typeConfig, setTypeConfig] = useState<ExponentialScaleConfig>(DEFAULT_TYPE_SCALE);
    const [spaceConfig, setSpaceConfig] = useState<MultiplierScaleConfig>(DEFAULT_SPACE_SCALE);

    const applyAll = useCallback((type: ExponentialScaleConfig, space: MultiplierScaleConfig) => {
        applyTypeScale(type);
        applySpaceScale(space);
        applyContainerScale(type.base.max.value);
    }, []);

    const handleBaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        const newType: ExponentialScaleConfig = {
            ...typeConfig,
            base: {
                min: { value: value * 0.95, unit: "rem" },
                max: { value, unit: "rem" },
            },
        };
        const newSpace: MultiplierScaleConfig = {
            ...spaceConfig,
            base: {
                min: { value: value * 0.875, unit: "rem" },
                max: { value, unit: "rem" },
            },
        };
        setTypeConfig(newType);
        setSpaceConfig(newSpace);
        applyAll(newType, newSpace);
    };

    const handleRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        const newConfig: ExponentialScaleConfig = {
            ...typeConfig,
            ratio: { min: value * 0.96, max: value },
        };
        setTypeConfig(newConfig);
        applyTypeScale(newConfig);
    };

    const handleRatioPresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const presetName = e.target.value as RatioPresetName;
        const value = RATIO_PRESETS[presetName];
        const newConfig: ExponentialScaleConfig = {
            ...typeConfig,
            ratio: { min: value * 0.96, max: value },
        };
        setTypeConfig(newConfig);
        applyTypeScale(newConfig);
    };

    const handleSpaceBaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value);
        const newConfig: MultiplierScaleConfig = {
            ...spaceConfig,
            base: {
                min: { value: value * 0.875, unit: "rem" },
                max: { value, unit: "rem" },
            },
        };
        setSpaceConfig(newConfig);
        applySpaceScale(newConfig);
    };

    const currentPreset = findClosestPreset(typeConfig.ratio.max);
    const presetOptions = Object.entries(RATIO_PRESETS);

    return (
        <Section title="SCALE">
            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">base</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={0.75}
                    max={1.5}
                    step={0.025}
                    value={typeConfig.base.max.value}
                    onChange={handleBaseChange}
                    aria-label="Base size"
                    aria-valuetext={`${typeConfig.base.max.value}rem`}
                />
                <span className="tweakpane-slider-value">{typeConfig.base.max.value}</span>
            </div>

            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">ratio</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={1.067}
                    max={1.618}
                    step={0.001}
                    value={typeConfig.ratio.max}
                    onChange={handleRatioChange}
                    aria-label="Type scale ratio"
                    aria-valuetext={`${typeConfig.ratio.max.toFixed(3)}`}
                />
                <span className="tweakpane-slider-value">{typeConfig.ratio.max.toFixed(3)}</span>
            </div>

            <div className="tweakpane-slider-row">
                <span className="tweakpane-slider-label">space</span>
                <input
                    type="range"
                    className="tweakpane-slider"
                    min={0.5}
                    max={1.5}
                    step={0.025}
                    value={spaceConfig.base.max.value}
                    onChange={handleSpaceBaseChange}
                    aria-label="Space base size"
                    aria-valuetext={`${spaceConfig.base.max.value}rem`}
                />
                <span className="tweakpane-slider-value">{spaceConfig.base.max.value}</span>
            </div>

            <div className="tweakpane-type-row">
                <label className="tweakpane-type-label" htmlFor="tweakpane-ratio-preset">
                    preset
                </label>
                <select
                    id="tweakpane-ratio-preset"
                    className="tweakpane-type-select"
                    value={currentPreset ?? ""}
                    onChange={handleRatioPresetChange}
                >
                    {!currentPreset && <option value="">Custom</option>}
                    {presetOptions.map(([name]) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>
        </Section>
    );
}
