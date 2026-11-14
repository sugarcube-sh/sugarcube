import { useKeyedState } from "./use-keyed-state";
import {
    type ColorDraft,
    type ColorField,
    getChannels,
    toColorCSS,
    findGamut,
    convertToSpace,
    spaceNames,
    getChannelTrack,
    withComponent,
} from "../controllers/color";
import { parseNumber } from "../controllers/typed-text";
import { Select } from "./Select";

export function ColorInput({
    draft,
    color,
    label,
    onDraft,
}: {
    draft: ColorDraft;
    color: ColorField | undefined;
    label: string;
    onDraft(draft: ColorDraft, control: string): void;
}) {
    const [fittedGamut, setFittedGamut] = useKeyedState<string>(draft);
    const change = (next: ColorDraft, control: string) => onDraft(next, control);
    const gamut = color && findGamut(color);
    const swatch = color && (
        <span
            aria-hidden="true"
            style={{
                display: "inline-block",
                inlineSize: "1.5em",
                blockSize: "1.5em",
                background: toColorCSS(color),
            }}
        />
    );

    const gamutNote = color && <span>{gamut ? `In ${gamut}` : "Outside Rec. 2020"}</span>;

    if (draft.kind === "hexColor") {
        return (
            <>
                {swatch}{" "}
                <input
                    aria-label={label}
                    value={draft.hex}
                    onChange={(event) => change({ ...draft, hex: event.target.value }, "hex")}
                />{" "}
                {gamutNote}
            </>
        );
    }

    const setComponent = (index: number, text: string) =>
        change(withComponent(draft, index, text), `channel ${index}`);

    return (
        <fieldset aria-label={label}>
            {swatch}{" "}
            <Select
                label={`${label}, colour space`}
                value={draft.colorSpace}
                options={spaceNames}
                onChange={(space) => {
                    const converted = convertToSpace(draft, space, color);
                    onDraft(converted.draft, "space");
                    setFittedGamut(converted.mappedGamut, converted.draft);
                }}
            />{" "}
            {gamutNote}
            {fittedGamut && <p>Chroma reduced to fit {fittedGamut}.</p>}
            {getChannels(draft.colorSpace).map((channel, index) => (
                <div key={channel.name}>
                    {channel.name}{" "}
                    <input
                        type="range"
                        aria-label={`${label}, ${channel.name}`}
                        min={channel.min}
                        max={channel.max}
                        step={channel.step}
                        value={toSliderValue(draft.components[index], channel.min)}
                        style={color ? { background: getChannelTrack(color, index) } : undefined}
                        onChange={(event) => setComponent(index, event.target.value)}
                    />{" "}
                    <input
                        aria-label={`${label}, ${channel.name}`}
                        inputMode="decimal"
                        value={draft.components[index] ?? ""}
                        onChange={(event) => setComponent(index, event.target.value)}
                    />
                </div>
            ))}
            {draft.colorSpace !== "" && (
                <div>
                    Alpha{" "}
                    <input
                        type="range"
                        aria-label={`${label}, alpha`}
                        min={0}
                        max={1}
                        step={0.001}
                        value={toSliderValue(draft.alpha, 1)}
                        onChange={(event) =>
                            change({ ...draft, alpha: event.target.value }, "alpha")
                        }
                    />{" "}
                    <input
                        aria-label={`${label}, alpha`}
                        inputMode="decimal"
                        value={draft.alpha}
                        onChange={(event) =>
                            change({ ...draft, alpha: event.target.value }, "alpha")
                        }
                    />
                </div>
            )}
        </fieldset>
    );
}

function toSliderValue(text: string | undefined, fallback: number): number {
    return parseNumber(text ?? "") ?? fallback;
}
