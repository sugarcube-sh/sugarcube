import { isDeepStrictEqual } from "node:util";
import {
    type CSSFileOutput,
    type Declarations,
    type InternalConfig,
    type LoadedConfig,
    type AnyDiagnostic,
    type UtilityCSS,
    generateCSS,
    fillDefaults,
    createReadOptions,
    getTokensOnDisk,
} from "@sugarcube-sh/core";
import { type DesignTokens, readFromMemory } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { type UnoGenerator, createGenerator } from "@unocss/core";
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

export interface BuildResult {
    tokens: DesignTokens;
    config: InternalConfig;
    entryFile: string;
    configFile?: string;
    declared: Declarations;
    variables: CSSFileOutput;
    utilities: CSSFileOutput;
    markupFiles: string[];
    utilityCSS?: UtilityCSS;
    diagnostics: AnyDiagnostic[];
    uno?: UnoGenerator;
}

interface BuildInput {
    tokens: DesignTokens;
    entryFile: string;
    config: InternalConfig;
    configFile?: string;
}

export async function build(
    loaded: LoadedConfig,
    options: BuildOptions = {},
): Promise<BuildResult> {
    const onDisk = getTokensOnDisk(loaded.config);
    const tokens = await read(onDisk.entryFile, onDisk.options);
    return buildFromTokens(tokens, loaded, options);
}

export function buildFromTokens(
    tokens: DesignTokens,
    { config, configFile }: LoadedConfig,
    options: BuildOptions = {},
    previous?: BuildResult,
): Promise<BuildResult> {
    const reading = { tokens, entryFile: config.resolver, config, configFile };
    return createBuild(reading, options, previous);
}

export function buildFromMemory(
    texts: Record<string, string>,
    entryFile: string,
): Promise<BuildResult> {
    const config = fillDefaults({});
    const tokens = readFromMemory({ files: texts, entryFile }, createReadOptions(config));
    return createBuild({ tokens, entryFile, config }, {});
}

export async function rescan(built: BuildResult): Promise<BuildResult> {
    if (!built.uno || !built.utilityCSS) return built;
    return { ...built, ...(await scanMarkup(built.uno, built.utilityCSS, built.config)) };
}

export function getTokenByVariable({ declared }: BuildResult): Map<string, string> {
    const tokenOf = new Map<string, string>();
    for (const { declared: declarations } of declared.entries) {
        for (const { name, token } of declarations.declarations) tokenOf.set(name, token.path);
    }
    return tokenOf;
}

export function getOutputFiles({ variables, utilities }: BuildResult): CSSFileOutput {
    return [...variables, ...utilities];
}

async function createBuild(
    { tokens, entryFile, config, configFile }: BuildInput,
    options: BuildOptions,
    previous?: BuildResult,
): Promise<BuildResult> {
    const generated = generateCSS(tokens, config, {
        variables: !options.utilitiesOnly,
        utilities: !options.variablesOnly,
    });
    const scan =
        generated.utilities && options.markup !== false
            ? await getMarkupUtilities(generated.utilities, config, previous)
            : { utilities: [], markupFiles: [] };
    return {
        tokens,
        config,
        entryFile,
        configFile,
        declared: generated.declared,
        variables: finishFiles(generated.variables, config.variables.layer),
        utilityCSS: generated.utilities,
        diagnostics: generated.diagnostics,
        ...scan,
    };
}

async function getMarkupUtilities(
    rules: UtilityCSS,
    config: InternalConfig,
    previous: BuildResult | undefined,
): Promise<MarkupScan & { uno: UnoGenerator }> {
    if (previous?.uno && hasSameUtilities(previous, rules, config)) {
        const { uno, utilities, markupFiles } = previous;
        return { uno, utilities, markupFiles };
    }
    const uno = await createUnoGenerator(rules);
    return { uno, ...(await scanMarkup(uno, rules, config)) };
}

function hasSameUtilities(
    previous: BuildResult,
    rules: UtilityCSS,
    config: InternalConfig,
): boolean {
    const before = previous.utilityCSS;
    return (
        previous.config === config &&
        before !== undefined &&
        isDeepStrictEqual([before.prefixes, before.safelist], [rules.prefixes, rules.safelist])
    );
}

function createUnoGenerator({ rules, safelist }: UtilityCSS): Promise<UnoGenerator> {
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
    return { utilities: finishFiles(files, config.utilities.layer), markupFiles };
}

function finishFiles(files: CSSFileOutput, layer: string | undefined): CSSFileOutput {
    return addBanner(layer ? wrapInLayer(files, layer) : files);
}
