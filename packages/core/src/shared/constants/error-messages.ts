import type {
    ConfigIssue,
    TypeName,
    SugarcubeDiagnosticDetailByKind,
    SugarcubeDiagnosticKind,
    UtilityEntry,
    UtilityWithoutClasses,
} from "../../types/diagnostics.js";

type Entry<K extends SugarcubeDiagnosticKind> = {
    severity: "error" | "warning";
    message: (detail: SugarcubeDiagnosticDetailByKind[K]) => string;
    help?: (detail: SugarcubeDiagnosticDetailByKind[K]) => string | undefined;
};

const diagnostics: { [K in SugarcubeDiagnosticKind]: Entry<K> } = {
    "default-required": {
        severity: "error",
        message: ({ modifiers }) =>
            `${listed(modifiers.map(quoted))} ${modifiers.length > 1 ? "have" : "has"} no default`,
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
            `\`${first}\` and \`${later}\` both make \`${name}\``,
    },
    "same-utility-class": {
        severity: "warning",
        message: ({ className, paths: [used, other] }) =>
            `\`${className}\` could mean \`${used}\` or \`${other}\``,
    },
    "utility-without-classes": {
        severity: "warning",
        message: (detail) => `${entryName(detail)} makes no classes: ${reasonText(detail)}`,
        help: (detail) =>
            detail.reason === "wrong-type" ? `use ${listed(detail.takes, "or")} tokens` : undefined,
    },
    "safelist-without-token": {
        severity: "warning",
        message: (detail) =>
            `\`${detail.part}\` in ${entryName(detail)}'s safelist matches no token`,
    },
    "invalid-config": {
        severity: "error",
        message: (issue) => configIssueText(issue),
    },
};

function reasonText(detail: UtilityWithoutClasses): string {
    const { property, source } = detail;
    switch (detail.reason) {
        case "no-tokens":
            return `no tokens under \`${detail.group}\``;
        case "no-type":
            return `DTCG has no ${property.replaceAll("-", " ")} type`;
        case "private":
            return `the tokens under \`${source}\` are private`;
        case "wrong-type":
            return `\`${source}\` has only ${listed(detail.found)} tokens`;
        case "typography":
            return `\`${source}\` has only typography tokens`;
        case "answered-first": {
            const by = detail.by.map(entryName);
            const starts = listed(detail.starts.map((start) => `\`${start}-…\``));
            return `${listed(by)} ${by.length > 1 ? "answer" : "answers"} every ${starts} class first`;
        }
    }
}

const ordinal = new Intl.PluralRules("en", { type: "ordinal" });
const SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
    one: "st",
    two: "nd",
    few: "rd",
    other: "th",
    zero: "th",
    many: "th",
};

export function configIssueText(issue: ConfigIssue): string {
    const subject = "setting" in issue && issue.setting ? quoted(issue.setting) : "the config";
    switch (issue.reason) {
        case "not-loaded":
            return `could not be loaded: ${issue.cause}`;
        case "deleted":
            return "was deleted; put it back, or restart to build without it";
        case "wrong-type":
            return `${subject} must be ${expectedText(issue)}, not ${aOrAn(issue.received)}`;
        case "missing":
            return `${subject} needs ${withArticle(quoted(issue.property))}`;
        case "not-allowed": {
            const allowed = listed(
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
            return `${subject} ${FORMS[issue.form]}, not ${JSON.stringify(issue.value)}`;
        case "no-resolver":
            return ErrorMessages.CONFIG.NO_CONFIG_OR_RESOLVER();
        case "several-resolvers":
            return ErrorMessages.CONFIG.MULTIPLE_RESOLVERS_FOUND(issue.paths);
        case "exports-nothing":
            return `\`${issue.file}\` exports nothing; export your config as \`export default { … }\``;
    }
}

const FORMS: Record<Extract<ConfigIssue, { reason: "wrong-form" }>["form"], string> = {
    "repository": 'is written as "owner/name", such as "acme/site"',
    "app": 'is the GitHub App\'s name as it appears in its address, such as "acme-studio" in github.com/apps/acme-studio',
    "sign-in": 'is a path on your site, such as "/api/sugarcube-studio"',
    "source": 'can have `*` only at the end, such as "color.*"',
};

function expectedText({
    expected,
    allowed,
}: Extract<ConfigIssue, { reason: "wrong-type" }>): string {
    if (allowed === undefined) return listed(expected.map(aOrAn), "or");
    const values = listed(
        allowed.map((value) => JSON.stringify(value)),
        "or",
    );
    return expected.includes("array") ? `${values}, or an array of them` : values;
}

const NO_ARTICLE = new Set<TypeName>(["null", "undefined", "NaN"]);

function aOrAn(type: TypeName): string {
    return NO_ARTICLE.has(type) ? type : withArticle(type);
}

function withArticle(word: string): string {
    return `${/^`?[aeiou]/i.test(word) ? "an" : "a"} ${word}`;
}

function entryName({ property, entry }: UtilityEntry): string {
    if (entry === undefined) return quoted(property);
    const place = entry + 1;
    return `${quoted(property)}'s ${place}${SUFFIXES[ordinal.select(place)]} entry`;
}

function quoted(name: string): string {
    return `\`${name}\``;
}

function listed(items: string[], conjunction = "and"): string {
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

    DIAGNOSTICS: diagnostics,
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

export function diagnosticDocs(kind: string): string {
    return `https://sugarcube.sh/errors/${kind}`;
}
