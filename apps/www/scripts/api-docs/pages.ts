import type { ApiSymbol } from "./extract.ts";

export const ENTRIES: Record<string, string> = {
    "@sugarcube-sh/dtcg": "index.ts",
    "@sugarcube-sh/dtcg/node": "node.ts",
    "@sugarcube-sh/dtcg/css": "css.ts",
    "@sugarcube-sh/dtcg/editor": "editor.ts",
    "@sugarcube-sh/dtcg/values": "values.ts",
};

export interface Section {
    title: string;
    names: readonly string[];
}

export interface PageConfig {
    slug: string;
    title: string;
    overview: string;
    description?: string;
    intro?: string;
    entry?: string;
    object?: string;
    first?: readonly string[];
    sections?: readonly Section[];
}

const MAIN = "@sugarcube-sh/dtcg";

export const PAGES: readonly PageConfig[] = [
    {
        slug: "dtcg",
        title: "@sugarcube-sh/dtcg",
        overview:
            "{@link read} and {@link readFromMemory} read tokens from text you pass them, so they work without a file system. Every type is imported from here.",
        description: "Read tokens in any runtime.",
        intro: "To read from disk with `node:fs`, use {@link @sugarcube-sh/dtcg/node} instead.",
        entry: MAIN,
        first: ["read", "readFromMemory", "tokenPath"],
        sections: [{ title: "Read options", names: ["ReadOptions", "ReadText", "TokensInMemory"] }],
    },
    {
        slug: "node",
        title: "@sugarcube-sh/dtcg/node",
        overview:
            "`read` reads tokens from disk. {@link createLiveTokens} reads them again each time a file changes. {@link findResolver} and {@link findTokenFiles} find the files to read.",
        description: "Read tokens from disk.",
        intro: "Returns the same {@link DesignTokens} as {@link @sugarcube-sh/dtcg}.",
        entry: "@sugarcube-sh/dtcg/node",
        first: ["read", "createLiveTokens", "findResolver", "findTokenFiles"],
    },
    {
        slug: "css",
        title: "@sugarcube-sh/dtcg/css",
        overview:
            "{@link getCSSBlocks} and {@link toCSS} write a stylesheet, with a block for each permutation. {@link toCSSValue} writes a single value. To change how names or values are written, use {@link createCSSWriter}.",
        description: "Write tokens as CSS.",
        intro: "{@link getCSSBlocks} computes what each block writes. {@link toCSS} writes the blocks as a stylesheet. For one-off value writes, use {@link toCSSValue}. To change the format of how values are written, make your own writer with {@link createCSSWriter}.",
        entry: "@sugarcube-sh/dtcg/css",
        first: ["getCSSBlocks", "toCSS", "createCSSWriter", "toCSSValue"],
    },
    {
        slug: "editor",
        title: "@sugarcube-sh/dtcg/editor",
        overview:
            "For editors and linters. {@link getSpan} finds where a token is written in its file, {@link getDiagnosticsAt} finds the problems under the cursor, and {@link getSourceLine} gets the line to print with a problem.",
        description: "Find where definitions and references are written.",
        intro: "For tools that show or change token files (e.g. editors and linters). {@link getSpan} and {@link getNameSpan} find where a definition or reference is written. {@link getJsonPath} returns the keys to it. {@link getJsonAt} gets the JSON written at those keys. {@link getDiagnosticsAt} finds the problems at a position and {@link getSourceLine} gets a span's line.",
        entry: "@sugarcube-sh/dtcg/editor",
        first: ["getSpan", "getNameSpan", "getJsonPath", "getJsonAt", "getDiagnosticsAt"],
    },
    {
        slug: "values",
        title: "@sugarcube-sh/dtcg/values",
        overview:
            "{@link parseValue} checks a value against its type, and {@link isEquivalentValue} compares two values. Also here: references as written, and the spec's types, units and keywords, such as {@link tokenTypes}.",
        description: "Check and compare values.",
        intro: "The checks and comparisons a read uses, for when you need them yourself, such as on a value someone types into a form.",
        entry: "@sugarcube-sh/dtcg/values",
        first: [
            "parseValue",
            "parseReference",
            "toJsonPointer",
            "toReferenceTarget",
            "createExtensionReader",
        ],
    },
    {
        slug: "design-tokens",
        title: "Design tokens",
        overview:
            "What a read returns. Look here for anything across every permutation: the list of permutations, every problem the read found, and {@link DesignTokens.getChangesSince}.",
        object: "DesignTokens",
    },
    {
        slug: "permutation",
        title: "Permutation",
        overview:
            'What {@link DesignTokens.getPermutation} returns: the tokens for one input, such as `{ mode: "dark" }`. Look here to get a token or a group.',
        object: "Permutation",
        sections: [
            { title: "Groups of permutations", names: ["Permutations", "PermutationGroup"] },
            { title: "Inputs", names: ["Input", "Scope"] },
        ],
    },
    {
        slug: "tokens-and-groups",
        title: "Tokens and groups",
        overview:
            "What {@link Permutation.getToken} and {@link Permutation.getGroup} return. Look here when you have a token and want its value, its type or the file it's written in.",
        description: "Tokens, groups, and their definitions.",
        sections: [
            {
                title: "Tokens and groups",
                names: ["Token", "TokenBase", "Group", "InheritedFrom"],
            },
            {
                title: "Definitions",
                names: [
                    "Definition",
                    "DefinitionInPermutations",
                    "LocalProperties",
                    "LocalToken",
                    "LocalGroup",
                ],
            },
        ],
    },
    {
        slug: "references",
        title: "References",
        overview:
            "A reference such as `{color.primary}`, read from either end: {@link Token.references} lists the ones a token writes, and {@link Permutation.getDependents} finds the tokens that use one.",
        description: "How tokens and groups refer to each other.",
        sections: [
            {
                title: "References",
                names: [
                    "Reference",
                    "ReferenceBase",
                    "ReferenceInPermutations",
                    "ReferenceOptions",
                ],
            },
            {
                title: "As written",
                names: ["ParsedReference", "CurlyBraceReference", "JsonPointerReference"],
            },
        ],
    },
    {
        slug: "changes",
        title: "Changes",
        overview:
            "What {@link DesignTokens.getChangesSince} returns: each token and group added, removed, changed or renamed between two reads.",
        description: "What changed between two reads.",
        sections: [
            {
                title: "Changes",
                names: ["Change", "TokenChange", "GroupChange", "TokenProperty", "GroupProperty"],
            },
            { title: "Moves", names: ["Move"] },
        ],
    },
    {
        slug: "resolver",
        title: "Files and the resolver",
        overview:
            "Where the tokens come from: {@link DesignTokens.files}, each source, and the resolver's sets, modifiers and contexts.",
        description: "The files a read used, and the resolver's sets, modifiers and contexts.",
        intro: "Where the tokens come from.",
        sections: [
            { title: "Sources", names: ["Source", "SourceRef", "ParentSet"] },
            {
                title: "The resolver",
                names: ["Resolver", "ResolverSet", "ResolverModifier", "ResolverContext"],
            },
        ],
    },
    {
        slug: "token-values",
        title: "Token values",
        overview:
            "The value of each token type. Check a token's `type`, and TypeScript knows the shape of its `resolvedValue`. Composite values, such as a border, are also split into parts.",
        description:
            "The value of each token type, the parts of composite values, and the results of checking a value.",
        intro: "Check a token's `type`, and TypeScript knows the shape of its value.",
        sections: [
            {
                title: "Types and values",
                names: [
                    "TokenType",
                    "ValueByType",
                    "UnresolvedValue",
                    "ColorValue",
                    "ColorSpace",
                    "ColorComponent",
                    "DimensionValue",
                    "DurationValue",
                    "CubicBezierValue",
                    "NumberValue",
                    "FontFamilyValue",
                    "FontWeightValue",
                    "StrokeStyleValue",
                    "StrokeStyleKeyword",
                    "BorderValue",
                    "ShadowValue",
                    "ShadowLayer",
                    "GradientValue",
                    "GradientStop",
                    "TransitionValue",
                    "TypographyValue",
                ],
            },
            {
                title: "Parts",
                names: [
                    "Part",
                    "PartBase",
                    "SimplePart",
                    "BorderPart",
                    "GradientPart",
                    "GradientStopPart",
                    "ShadowPart",
                    "ShadowLayerPart",
                    "StrokeStylePart",
                    "TransitionPart",
                    "TypographyPart",
                ],
            },
            {
                title: "Checking a value",
                names: [
                    "ParseOptions",
                    "ParseResult",
                    "IgnoredProperty",
                    "ValueError",
                    "ValueErrorCode",
                    "ValueErrorDetail",
                ],
            },
            { title: "JSON", names: ["JsonPath", "JsonValue", "JsonObject"] },
        ],
    },
    {
        slug: "problems",
        title: "Problems and errors",
        overview:
            "What's in {@link DesignTokens.diagnostics}. A read never throws for a problem in the files. It throws only when you ask for something it can't answer, such as a permutation that doesn't exist.",
        description: "What a diagnostic holds, where it is, and the errors dtcg throws.",
        intro: "A read never throws for a problem in the files: it reports a diagnostic. It throws only for a question asked the wrong way.",
        sections: [
            {
                title: "Diagnostics",
                names: [
                    "Diagnostic",
                    "DiagnosticKind",
                    "DiagnosticDetailByKind",
                    "DiagnosticOf",
                    "InputProblem",
                    "ResolverProblem",
                    "ResolverRule",
                    "JsonErrorReason",
                ],
            },
            { title: "Where it is", names: ["Span", "SourceLine"] },
            {
                title: "Errors",
                names: [
                    "PermutationError",
                    "PermutationErrorDetail",
                    "SeveralPermutationsError",
                    "SeveralPermutationsDetail",
                    "EntryFileError",
                    "EntryFileErrorDetail",
                ],
            },
        ],
    },
    {
        slug: "extensions",
        title: "Extensions and generators",
        overview:
            "Passed to `read` to check your own `$extensions` and to make tokens from them, such as a scale of sizes from one token.",
        description: "Checking your own `$extensions`, and making tokens from them.",
        intro: "Passed to `read` in `extensionValidators` and `generators`.",
        sections: [
            {
                title: "Validators",
                names: [
                    "ExtensionValidator",
                    "ExtensionMessages",
                    "ExtensionError",
                    "StandardSchemaV1",
                ],
            },
            { title: "Generators", names: ["Generator", "GeneratedToken"] },
        ],
    },
];

export interface PlacedPage {
    config: PageConfig;
    object?: ApiSymbol;
    sections: { title: string; symbols: ApiSymbol[] }[];
}

const SECTION_TITLES = ["Functions", "Namespaces", "Values", "Classes", "Types"] as const;

function sectionTitle(symbol: ApiSymbol): (typeof SECTION_TITLES)[number] {
    if (symbol.kind === "function") return "Functions";
    if (symbol.kind === "class") return "Classes";
    if (symbol.kind === "variable")
        return symbol.members.some((member) => member.kind === "method") ? "Namespaces" : "Values";
    return "Types";
}

export function placeSymbols(symbols: readonly ApiSymbol[]): {
    pages: PlacedPage[];
    unplaced: string[];
} {
    const byName = new Map(symbols.map((symbol) => [symbol.name, symbol]));
    const placed = new Set<string>();
    const pages: PlacedPage[] = [];
    for (const config of PAGES) {
        const object = config.object ? byName.get(config.object) : undefined;
        if (config.object && !object)
            throw new Error(`${config.slug}: no export named ${config.object}`);
        if (object) placed.add(object.name);
        if (Boolean(object) === Boolean(config.description))
            throw new Error(
                `${config.slug}: give a description, or an object whose doc comment gives one, not both`,
            );
        const named = (config.sections ?? []).map((section) => ({
            title: section.title,
            symbols: section.names.map((name) => {
                const symbol = byName.get(name);
                if (!symbol) throw new Error(`${config.slug}: no export named ${name}`);
                placed.add(name);
                return symbol;
            }),
        }));
        const sections = config.entry
            ? [...entrySections(symbols, config.entry, config.first ?? [], placed), ...named]
            : named;
        pages.push({ config, ...(object && { object }), sections });
    }
    const unplaced = symbols
        .filter((symbol) => !placed.has(symbol.name))
        .map((symbol) => `${symbol.entry}: ${symbol.name}`);
    return { pages, unplaced };
}

function entrySections(
    symbols: readonly ApiSymbol[],
    entry: string,
    first: readonly string[],
    placed: Set<string>,
) {
    const rank = (symbol: ApiSymbol) =>
        first.includes(symbol.name) ? first.indexOf(symbol.name) : first.length;
    const own = symbols.filter(
        (symbol) =>
            symbol.entry === entry &&
            !(
                entry === MAIN &&
                (symbol.kind === "interface" || symbol.kind === "type" || symbol.kind === "class")
            ),
    );
    return SECTION_TITLES.map((title) => {
        const inSection = own
            .filter((symbol) => sectionTitle(symbol) === title)
            .sort((a, b) => rank(a) - rank(b));
        for (const symbol of inSection) placed.add(symbol.name);
        return { title, symbols: inSection };
    }).filter((section) => section.symbols.length > 0);
}
