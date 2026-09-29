// A palette page. Groups of plain colors show as swatch ramps, and colors that point at a palette
// show underneath as roles, each with the swatch it points at.
import {
    defaultPermutation,
    isAlias,
    type ColorValue,
    type Document,
    type Token,
} from "@sugarcube-sh/dtcg";

declare const doc: Document;
declare function swatch(color: ColorValue | undefined): string;

type ColorToken = Extract<Token, { type: "color" }>;

const ramps = new Map<string, ColorToken[]>();
const roles: ColorToken[] = [];

for (const t of Object.values(defaultPermutation(doc)?.tokens ?? {})) {
    if (t.type !== "color") continue;
    if (isAlias(t.value)) {
        roles.push(t);
        continue;
    }
    const group = t.path.slice(0, t.path.lastIndexOf("."));
    ramps.set(group, [...(ramps.get(group) ?? []), t]);
}

for (const [group, steps] of ramps) row(group, ...steps.map((step) => swatch(step.resolved)));
for (const role of roles) row(role.path, role.aliasOf, swatch(role.resolved));
