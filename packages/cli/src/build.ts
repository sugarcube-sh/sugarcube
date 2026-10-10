import { isDeepStrictEqual } from "node:util";
import {
    type CSSFileOutput,
    type Declarations,
    type InternalConfig,
    type LoadedConfig,
    type Reported,
    type UtilityCSS,
    type UtilityStart,
    cssFrom,
    fillDefaults,
    readOptions,
} from "@sugarcube-sh/core";
import { type Document, readFromMemory } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { type UnoGenerator, createGenerator } from "@unocss/core";
import { dirname } from "pathe";
import { addBanner, utilitiesFromMarkup, wrapInLayer } from "./output.js";

export interface BuildOptions {
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
    markup?: boolean;
}

interface UtilityGenerator {
    starts: UtilityStart[];
    safelist: string[];
    uno: UnoGenerator;
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
    diagnostics: Reported[];
    generator?: UtilityGenerator;
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
    if (!built.generator) return built;
    const { files, markupFiles } = await scanned(built.generator, built.config);
    return { ...built, utilities: files, markupFiles };
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
    const markup = options.markup ?? true;
    const utilities = await utilitiesFrom(made.utilities, config, markup, previous);
    return {
        doc,
        config,
        folder,
        configFile,
        declared: made.declared,
        variables: finished(made.variables, config.variables.layer),
        utilities: utilities.files,
        markupFiles: utilities.markupFiles,
        diagnostics: made.diagnostics,
        generator: utilities.generator,
    };
}

async function utilitiesFrom(
    utilities: UtilityCSS | undefined,
    config: InternalConfig,
    markup: boolean,
    previous: Built | undefined,
): Promise<{ files: CSSFileOutput; markupFiles: string[]; generator?: UtilityGenerator }> {
    if (!utilities || !markup) return { files: [], markupFiles: [] };
    const { rules, starts, safelist } = utilities;
    if (previous?.generator && previous.config === config) {
        const { generator, utilities: files, markupFiles } = previous;
        const same = isDeepStrictEqual([generator.starts, generator.safelist], [starts, safelist]);
        if (same) return { files, markupFiles, generator };
    }
    const uno = await createGenerator({
        presets: [{ name: "sugarcube", rules, preflights: [] }],
        safelist,
    });
    const generator = { starts, safelist, uno };
    return { ...(await scanned(generator, config)), generator };
}

async function scanned(generator: UtilityGenerator, config: InternalConfig) {
    const { files, markupFiles } = await utilitiesFromMarkup(
        generator.uno,
        generator.safelist,
        config,
    );
    return { files: finished(files, config.utilities.layer), markupFiles };
}

function finished(files: CSSFileOutput, layer: string | undefined): CSSFileOutput {
    return addBanner(layer ? wrapInLayer(files, layer) : files);
}
