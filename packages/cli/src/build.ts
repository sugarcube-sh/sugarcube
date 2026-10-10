import { isDeepStrictEqual } from "node:util";
import {
    type CSSFileOutput,
    type Declarations,
    type InternalConfig,
    type LoadedConfig,
    type Reported,
    type UtilityCSS,
    cssFrom,
    fillDefaults,
    readOptions,
} from "@sugarcube-sh/core";
import { type Document, readFromMemory } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { type UnoGenerator, createGenerator } from "@unocss/core";
import { dirname } from "pathe";
import { addBanner, wrapInLayer } from "./output.js";
import { getMarkupFiles, readMarkupSources } from "./scan-markup.js";

export interface BuildOptions {
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
    markup?: boolean;
}

interface MarkupScan {
    utilities: CSSFileOutput;
    markupFiles: string[];
}

export interface Built {
    doc: Document;
    config: InternalConfig;
    folder: string;
    configFile?: string;
    declared: Declarations;
    variables: CSSFileOutput;
    utilities: CSSFileOutput;
    markupFiles: string[];
    utilityRules?: UtilityCSS;
    diagnostics: Reported[];
    uno?: UnoGenerator;
}

interface Reading {
    doc: Document;
    folder: string;
    config: InternalConfig;
    configFile?: string;
}

export async function build(loaded: LoadedConfig, options: BuildOptions = {}): Promise<Built> {
    const doc = await read(loaded.config.resolver, readOptions(loaded.config));
    return buildFrom(doc, loaded, options);
}

export function buildFrom(
    doc: Document,
    { config, configFile }: LoadedConfig,
    options: BuildOptions = {},
    previous?: Built,
): Promise<Built> {
    const reading = { doc, folder: dirname(config.resolver), config, configFile };
    return fromReading(reading, options, previous);
}

export function buildFiles(texts: Record<string, string>, folder: string): Promise<Built> {
    const config = fillDefaults({});
    const doc = readFromMemory({ files: texts }, readOptions(config));
    return fromReading({ doc, folder, config }, {});
}

export async function rescan(built: Built): Promise<Built> {
    if (!built.uno || !built.utilityRules) return built;
    return { ...built, ...(await scanMarkup(built.uno, built.utilityRules, built.config)) };
}

export function variablesOf({ declared }: Built): Map<string, string> {
    const tokenOf = new Map<string, string>();
    for (const { declared: made } of declared.entries) {
        for (const { name, token } of made.declarations) tokenOf.set(name, token.path);
    }
    return tokenOf;
}

export function filesOf({ variables, utilities }: Built): CSSFileOutput {
    return [...variables, ...utilities];
}

async function fromReading(
    { doc, folder, config, configFile }: Reading,
    options: BuildOptions,
    previous?: Built,
): Promise<Built> {
    const made = cssFrom(doc, config, {
        variables: !options.utilitiesOnly,
        utilities: !options.variablesOnly,
    });
    const scan =
        made.utilities && options.markup !== false
            ? await markupUtilities(made.utilities, config, previous)
            : { utilities: [], markupFiles: [] };
    return {
        doc,
        config,
        folder,
        configFile,
        declared: made.declared,
        variables: finished(made.variables, config.variables.layer),
        utilityRules: made.utilities,
        diagnostics: made.diagnostics,
        ...scan,
    };
}

async function markupUtilities(
    rules: UtilityCSS,
    config: InternalConfig,
    previous: Built | undefined,
): Promise<MarkupScan & { uno: UnoGenerator }> {
    if (previous?.uno && unchanged(previous, rules, config)) {
        const { uno, utilities, markupFiles } = previous;
        return { uno, utilities, markupFiles };
    }
    const uno = await generatorFor(rules);
    return { uno, ...(await scanMarkup(uno, rules, config)) };
}

function unchanged(previous: Built, rules: UtilityCSS, config: InternalConfig): boolean {
    const before = previous.utilityRules;
    return (
        previous.config === config &&
        before !== undefined &&
        isDeepStrictEqual([before.starts, before.safelist], [rules.starts, rules.safelist])
    );
}

function generatorFor({ rules, safelist }: UtilityCSS): Promise<UnoGenerator> {
    return createGenerator({ presets: [{ name: "sugarcube", rules, preflights: [] }], safelist });
}

async function scanMarkup(
    uno: UnoGenerator,
    { safelist }: UtilityCSS,
    config: InternalConfig,
): Promise<MarkupScan> {
    const markupFiles = await getMarkupFiles(config.content);
    if (markupFiles.length === 0 && safelist.length === 0) return { utilities: [], markupFiles };
    const sources = await readMarkupSources(markupFiles);
    const { css } = await uno.generate(sources.join("\n"), { preflights: false });
    if (!css?.trim()) return { utilities: [], markupFiles };
    const files = [{ path: config.utilities.path, css }];
    return { utilities: finished(files, config.utilities.layer), markupFiles };
}

function finished(files: CSSFileOutput, layer: string | undefined): CSSFileOutput {
    return addBanner(layer ? wrapInLayer(files, layer) : files);
}
