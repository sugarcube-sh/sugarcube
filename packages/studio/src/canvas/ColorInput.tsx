import { useHeld } from "./use-held";
import {
    type ColorDraft,
    type ColorField,
    channelsOf,
    colorCss,
    gamutOf,
    inSpace,
    spaceNames,
    trackOf,
    withComponent,
} from "../controllers/color";
import { numberIn } from "../controllers/typed-text";
import { Choice } from "./Choice";

export function ColorInput({
    draft,
    shown,
    label,
    onDraft,
}: {
    draft: ColorDraft;
    shown: ColorField | undefined;
    label: string;
    onDraft(draft: ColorDraft, control: string): void;
}) {
    const [fitted, holdFitted] = useHeld<string>(draft);
    const change = (next: ColorDraft, control: string) => onDraft(next, control);
    const gamut = shown && gamutOf(shown);
    const swatch = shown && (
        <span
            aria-hidden="true"
            style={{
                display: "inline-block",
                inlineSize: "1.5em",
                blockSize: "1.5em",
                background: colorCss(shown),
            }}
        />
    );

    const where = shown && <span>{gamut ? `In ${gamut}` : "Outside Rec. 2020"}</span>;

    if (draft.kind === "hexColor") {
        return (
            <>
                {swatch}{" "}
                <input
                    aria-label={label}
                    value={draft.hex}
                    onChange={(event) => change({ ...draft, hex: event.target.value }, "hex")}
                />{" "}
                {where}
            </>
        );
    }

    const component = (index: number, text: string) =>
        change(withComponent(draft, index, text), `channel ${index}`);

    return (
        <fieldset aria-label={label}>
            {swatch}{" "}
            <Choice
                label={`${label}, colour space`}
                chosen={draft.colorSpace}
                choices={spaceNames}
                onChoose={(space) => {
                    const converted = inSpace(draft, space, shown);
                    onDraft(converted.draft, "space");
                    holdFitted(converted.fitted, converted.draft);
                }}
            />{" "}
            {where}
            {fitted && <p>Chroma reduced to fit {fitted}.</p>}
            {channelsOf(draft.colorSpace).map((channel, index) => (
                <div key={channel.name}>
                    {channel.name}{" "}
                    <input
                        type="range"
                        aria-label={`${label}, ${channel.name}`}
                        min={channel.min}
                        max={channel.max}
                        step={channel.step}
                        value={sliderValue(draft.components[index], channel.min)}
                        style={shown ? { background: trackOf(shown, index) } : undefined}
                        onChange={(event) => component(index, event.target.value)}
                    />{" "}
                    <input
                        aria-label={`${label}, ${channel.name}`}
                        inputMode="decimal"
                        value={draft.components[index] ?? ""}
                        onChange={(event) => component(index, event.target.value)}
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
                        value={sliderValue(draft.alpha, 1)}
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

function sliderValue(text: string | undefined, otherwise: number): number {
    return numberIn(text ?? "") ?? otherwise;
}
