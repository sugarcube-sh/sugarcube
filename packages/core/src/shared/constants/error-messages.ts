import type {
    ConfigIssue,
    TypeName,
    SugarcubeDiagnosticDetailByKind,
    SugarcubeDiagnosticKind,
    UtilityEntry,
    UtilityWithoutClasses,
} from "../../types/diagnostics.js";

type DiagnosticMessage<K extends SugarcubeDiagnosticKind> = {
    severity: "error" | "warning";
    message: (detail: SugarcubeDiagnosticDetailByKind[K]) => string;
    help?: (detail: SugarcubeDiagnosticDetailByKind[K]) => string | undefined;
};

const diagnosticMessages: { [K in SugarcubeDiagnosticKind]: DiagnosticMessage<K> } = {
    "default-required": {
        severity: "error",
        message: ({ modifiers }) =>
            `${formatList(modifiers.map(quote))} ${modifiers.length > 1 ? "have" : "has"} no default`,
    },
    "default-not-first": {
        severity: "warning",
        message: () => "the default isn't listed first",
    },
    "fluid-text-zoom": {
        severity: "warning",
        message: () => "won't zoom to 200%",
    },
    "option-renamed": {
        severity: "warning",
        message: ({ from, to }) => `\`${from}\` is now \`${to}\``,
    },
    "option-deprecated": {
        severity: "warning",
        message: ({ option, property }) =>
            `\`${option}\`${property ? ` in \`${property}\`` : ""} is deprecated`,
    },
    "fallback-missing": {
        severity: "warning",
        message: () => "no `hex` fallback",
    },
    "same-variable-name": {
        severity: "error",
        message: ({ name, paths: [first, later] }) =>
            `\`${first}\` and \`${later}\` are both \`${name}\``,
    },
    "same-utility-class": {
        severity: "warning",
        message: ({ className, paths: [used, other] }) =>
            `\`${className}\` could mean \`${used}\` or \`${other}\``,
    },
    "utility-without-classes": {
        severity: "warning",
        message: (detail) => `${formatEntryName(detail)} makes no classes: ${formatReason(detail)}`,
        help: (detail) =>
            detail.reason === "wrong-type"
                ? `use ${formatList(detail.expected, "or")} tokens`
                : undefined,
    },
    "safelist-without-token": {
        severity: "warning",
        message: (detail) =>
            `\`${detail.part}\` in ${formatEntryName(detail)}'s safelist matches no token`,
    },
    "invalid-config": {
        severity: "error",
        message: (issue) => formatConfigIssue(issue),
    },
};

function formatReason(detail: UtilityWithoutClasses): string {
    const { property, source } = detail;
    switch (detail.reason) {
        case "no-tokens":
            return `no tokens under \`${detail.group}\``;
        case "no-type":
            return `DTCG has no ${property.replaceAll("-", " ")} type`;
        case "private":
            return `the tokens under \`${source}\` are private`;
        case "wrong-type":
            return `\`${source}\` has only ${formatList(detail.received)} tokens`;
        case "typography":
            return `\`${source}\` has only typography tokens`;
        case "classes-taken": {
            const by = detail.by.map(formatEntryName);
            const prefixes = formatList(detail.prefixes.map((prefix) => `\`${prefix}-…\``));
            return `${formatList(by)} already ${by.length > 1 ? "make" : "makes"} every ${prefixes} class`;
        }
    }
}

const ordinalRules = new Intl.PluralRules("en", { type: "ordinal" });
const ORDINAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
    one: "st",
    two: "nd",
    few: "rd",
    other: "th",
    zero: "th",
    many: "th",
};

export function formatConfigIssue(issue: ConfigIssue): string {
    const subject = "setting" in issue && issue.setting ? quote(issue.setting) : "the config";
    switch (issue.reason) {
        case "not-loaded":
            return `could not be loaded: ${issue.cause}`;
        case "deleted":
            return "was deleted; put it back, or restart to build without it";
        case "wrong-type":
            return `${subject} must be ${formatExpected(issue)}, not ${addTypeArticle(issue.received)}`;
        case "missing":
            return `${subject} needs ${addArticle(quote(issue.property))}`;
        case "not-allowed": {
            const allowed = formatList(
                issue.allowed.map((value) => JSON.stringify(value)),
                "or",
            );
            return `${subject} must be ${allowed}, not ${JSON.stringify(issue.value)}`;
        }
        case "unknown":
            return `${subject} is not a setting`;
        case "empty":
            return `${subject} is empty`;
        case "no-selectors":
            return `${subject} lists no selectors`;
        case "empty-source":
            return `${subject} is empty: name the group its tokens come from, such as "color.*"`;
        case "wrong-form":
            return `${subject} ${FORM_DESCRIPTIONS[issue.form]}, not ${JSON.stringify(issue.value)}`;
        case "no-resolver":
            return ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER();
        case "several-resolvers":
            return ErrorMessages.CONFIG.MULTIPLE_RESOLVERS_FOUND(issue.paths);
        case "exports-nothing":
            return `\`${issue.file}\` exports nothing; export your config as \`export default { … }\``;
    }
}

const FORM_DESCRIPTIONS: Record<Extract<ConfigIssue, { reason: "wrong-form" }>["form"], string> = {
    "repository": 'is written as "owner/name", such as "acme/site"',
    "app": 'is the GitHub App\'s name as it appears in its address, such as "acme-studio" in github.com/apps/acme-studio',
    "sign-in": 'is a path on your site, such as "/api/sugarcube-studio"',
    "source": 'can have `*` only at the end, such as "color.*"',
};

function formatExpected({
    expected,
    allowed,
}: Extract<ConfigIssue, { reason: "wrong-type" }>): string {
    if (allowed === undefined) return formatList(expected.map(addTypeArticle), "or");
    const values = formatList(
        allowed.map((value) => JSON.stringify(value)),
        "or",
    );
    return expected.includes("array") ? `${values}, or an array of them` : values;
}

const TYPES_WITHOUT_ARTICLE = new Set<TypeName>(["null", "undefined", "NaN"]);

function addTypeArticle(type: TypeName): string {
    return TYPES_WITHOUT_ARTICLE.has(type) ? type : addArticle(type);
}

function addArticle(word: string): string {
    return `${/^`?[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

function formatEntryName({ property, entry }: UtilityEntry): string {
    if (entry === undefined) return quote(property);
    const place = entry + 1;
    return `${quote(property)}'s ${place}${ORDINAL_SUFFIXES[ordinalRules.select(place)]} entry`;
}

function quote(name: string): string {
    return `\`${name}\``;
}

function formatList(items: string[], conjunction = "and"): string {
    return items.length > 2
        ? `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`
        : items.join(` ${conjunction} `);
}

export const ErrorMessages = {
    CONFIG: {
        MULTIPLE_RESOLVERS_FOUND: (paths: string[]) =>
            `Several resolver files were found:\n${paths.map((f) => `  - ${f}`).join("\n")}\n\nName the one to use as \`resolver\` in sugarcube.config.ts.`,
        NO_CONFIG_OR_RESOLVER: () =>
            "No design tokens found.\n\nRun @sugarcube-sh/cli init to set up your design tokens.\n\nStuck? https://sugarcube.sh/docs",
    },

    DIAGNOSTICS: diagnosticMessages,
    FLUID_EXTENSION: {
        "not-an-object": ({ name }: { name: string }) => `\`${name}\` must be an object`,
        "missing-property": ({ name }: { name: string }) => `the fluid range needs \`${name}\``,
    },
    SCALE_RECIPE: {
        "not-an-object": ({ name }: { name: string }) => `\`${name}\` must be an object`,
        "missing-property": ({ name }: { name: string }) => `the recipe needs \`${name}\``,
        "unknown-mode": ({ mode }: { mode: unknown }) => ({
            message: `\`${typeof mode === "string" ? mode : JSON.stringify(mode)}\` is not a mode`,
            help: 'use "exponential" or "multipliers"',
        }),
        "ratio-not-above-one": ({ ratio }: { ratio: number }) =>
            `a ratio of ${ratio} must be more than 1`,
        "not-a-count": ({ name }: { name: string }) =>
            `\`${name}\` must be a whole number, 0 or more`,
        "no-multipliers": () => "`multipliers` is empty",
        "invalid-pairs": () => '`pairs` must be "adjacent" or a list of pairs',
        "invalid-pair": ({ entry }: { entry: unknown }) => ({
            message: `${JSON.stringify(entry)} is not a pair`,
            help: 'write two names joined by "-", such as "sm-lg"',
        }),
        "unknown-multiplier": ({ name }: { name: string }) =>
            `\`${name}\` is not one of the recipe's multipliers`,
    },
} as const;

export function getDiagnosticDocsURL(kind: string): string {
    return `https://sugarcube.sh/errors/${kind}`;
}
