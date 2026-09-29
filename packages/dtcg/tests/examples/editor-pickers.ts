// An editor's dropdowns and sliders, filled from the spec's own lists: font weights, stroke styles,
// line caps, units, token types, and each color space's channels and ranges.
import {
    fontWeightKeywords,
    strokeStyleKeywords,
    lineCaps,
    colorSpaces,
    dimensionUnits,
    durationUnits,
    tokenTypes,
} from "@sugarcube-sh/dtcg/values";

for (const [name, weight] of Object.entries(fontWeightKeywords)) row(name, weight);
row(
    strokeStyleKeywords.join(", "),
    lineCaps.join(", "),
    dimensionUnits.join(", "),
    durationUnits.join(", "),
);
for (const [space, channels] of Object.entries(colorSpaces)) {
    row(space, channels.map((c) => `${c.name} ${c.min}–${c.max}`).join(", "));
}
row(tokenTypes.length);
