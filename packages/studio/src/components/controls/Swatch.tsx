"use client";

const SWATCH_GROUP_COUNT = 3;

type SwatchProps = {
    color: string | undefined;
};

function Swatch({ color }: SwatchProps) {
    return (
        <span
            data-slot="swatch"
            className="swatch"
            aria-hidden
            style={{ "--swatch-color": color } as React.CSSProperties}
        />
    );
}

type Shade = string | undefined;

const SWATCH_GROUP_MARGIN = 0.25;

function sampleShades(shades: Shade[], count: number): Shade[] {
    if (count <= 0) return [];
    if (shades.length <= count) return shades;

    const last = shades.length - 1;
    let start = Math.round(last * SWATCH_GROUP_MARGIN);
    let end = Math.round(last * (1 - SWATCH_GROUP_MARGIN));

    if (end - start + 1 < count) {
        start = Math.max(0, Math.floor(last / 2) - Math.floor((count - 1) / 2));
        end = Math.min(last, start + count - 1);
        start = Math.max(0, end - count + 1);
    }

    return Array.from({ length: count }, (_, i) => {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const index = Math.round(start + t * (end - start));
        return shades[index];
    });
}

function representativeShade(shades: Shade[]): Shade {
    if (shades.length === 0) return undefined;
    return shades[Math.floor(shades.length / 2)] ?? shades[0];
}

type SwatchGroupProps = {
    shades: Shade[];
};

function SwatchGroup({ shades }: SwatchGroupProps) {
    const colors = sampleShades(shades, SWATCH_GROUP_COUNT);

    return (
        <span data-slot="swatch-group" className="swatch-group" aria-hidden>
            {colors.map((color, index) => (
                <Swatch
                    // oxlint-disable-next-line react/no-array-index-key -- fixed-order ramp sample
                    key={index}
                    color={color}
                />
            ))}
        </span>
    );
}

export { Swatch, SwatchGroup, representativeShade, sampleShades };
export type { SwatchGroupProps, SwatchProps };
