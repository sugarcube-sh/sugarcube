// Design and layout heavily inspired by forges (https://forges.link/, MIT). Many thanks to that awesome project. Go check it out!
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractApi } from "./extract.ts";
import { ENTRIES, type PlacedPage, placeSymbols } from "./pages.ts";
import { BANNER, type Links, buildLinks, prose, renderPage } from "./render.ts";

const here = dirname(fileURLToPath(import.meta.url));
export const sourceDirectory = join(here, "../../../../packages/dtcg/src");
const configFile = join(here, "../../../../tsconfig.json");
const outDirectory = join(here, "../../src/content/docs/dtcg/docs/reference");

export interface GeneratedReference {
    pages: number;
    exports: number;
    undocumented: string[];
}

export function generateApiDocs(): GeneratedReference {
    const symbols = extractApi(sourceDirectory, ENTRIES, configFile);
    const { pages, unplaced } = placeSymbols(symbols);
    if (unplaced.length) {
        throw new Error(
            `These exports are on no reference page; add each to scripts/api-docs/pages.ts:\n  ${unplaced.join("\n  ")}`,
        );
    }

    const undocumented = symbols.flatMap((symbol) => [
        ...(symbol.description ||
        (symbol.signatures.length > 0 &&
            symbol.signatures.every((signature) => signature.doc?.description))
            ? []
            : [symbol.name]),
        ...symbol.members
            .filter(
                (member) =>
                    member.kind === "method" && !member.description && !member.inheritedFrom,
            )
            .map((member) => `${symbol.name}.${member.name}`),
    ]);

    const links = buildLinks(pages);
    const files = new Map<string, string>([["overview.mdx", renderOverview(pages, links)]]);
    pages.forEach((page, index) =>
        files.set(`${page.config.slug}.mdx`, renderPage(page, index + 2, links)),
    );

    mkdirSync(outDirectory, { recursive: true });
    const generated = readdirSync(outDirectory).filter((name) =>
        readFileSync(join(outDirectory, name), "utf8").includes(BANNER),
    );
    for (const name of files.keys()) {
        if (existsSync(join(outDirectory, name)) && !generated.includes(name)) {
            throw new Error(
                `${join(outDirectory, name)} was written by hand; rename it or the generated page`,
            );
        }
    }
    for (const name of generated) rmSync(join(outDirectory, name));
    for (const [name, content] of files) writeFileSync(join(outDirectory, name), content);
    return { pages: files.size, exports: symbols.length, undocumented };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { pages, exports, undocumented } = generateApiDocs();
    if (undocumented.length) {
        console.warn(`These exports have no doc comment:\n  ${undocumented.join("\n  ")}`);
    }
    console.log(`Wrote ${pages} reference pages from ${exports} exports.`);
}

function renderOverview(pages: readonly PlacedPage[], links: Links): string {
    const section = (page: PlacedPage) => {
        const title = page.config.entry ? `\`${page.config.title}\`` : page.config.title;
        return [
            `### ${title}`,
            "",
            `${prose(page.config.overview, links)} See [${title}](/dtcg/docs/reference/${page.config.slug}/).`,
            "",
        ];
    };
    return [
        "---",
        'title: "Overview"',
        "sidebar:",
        "  order: 1",
        "---",
        "",
        BANNER,
        "",
        "dtcg reads DTCG design tokens and resolver documents. Use it to build your own token-related tools.",
        "",
        "```ts",
        'import { read } from "@sugarcube-sh/dtcg/node";',
        "",
        'const tokens = await read("tokens.resolver.json"); // DesignTokens',
        'const dark = tokens.getPermutation({ mode: "dark" }); // Permutation',
        'const primary = dark.getToken("color.primary"); // Token',
        "",
        "primary?.resolvedValue; // the value, with references followed",
        "primary?.references; // Reference[]",
        "```",
        "",
        "## Entry points",
        "",
        ...pages.filter((page) => page.config.entry).flatMap(section),
        "## Types",
        "",
        ...pages.filter((page) => !page.config.entry).flatMap(section),
    ].join("\n");
}
