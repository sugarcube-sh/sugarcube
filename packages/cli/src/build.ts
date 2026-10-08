import { isDeepStrictEqual } from "node:util";
import {
    type CSSFileOutput,
    type Declarations,
    type InternalConfig,
    type LoadedConfig,
    type Reported,
    type UtilityStart,
    declare,
    emitCSS,
    fillDefaults,
    readOptions,
    utilityRules,
    utilityTokens,
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
    folder: string;
    configFile?: string;
    variables: CSSFileOutput;
    utilities: CSSFileOutput;
    diagnostics: Reported[];
    generator?: UtilityGenerator;
}

interface Reading {
    doc: Document;
    folder: string;
    config: InternalConfig;
    configFile?: string;
}

interface Made {
    files: CSSFileOutput;
    diagnostics: Reported[];
    generator?: UtilityGenerator;
}

const nothing: Made = { files: [], diagnostics: [] };

export async function build(
    { config, configFile }: LoadedConfig,
    options: BuildOptions = {},
    previous?: Built,
): Promise<Built> {
    const doc = await read(config.resolver, readOptions(config));
    const reading = { doc, folder: dirname(config.resolver), config, configFile };
    return fromReading(reading, options, previous);
}

export function buildFiles(texts: Record<string, string>, folder: string): Promise<Built> {
    const config = fillDefaults({});
    const doc = readFromMemory({ files: texts }, readOptions(config));
    return fromReading({ doc, folder, config }, {});
}

export async function rescan(built: Built, config: InternalConfig): Promise<Built> {
    if (!built.generator) return built;
    return { ...built, utilities: await scanned(built.generator, config) };
}

export function filesOf({ variables, utilities }: Built): CSSFileOutput {
    return [...variables, ...utilities];
}

async function fromReading(
    { doc, folder, config, configFile }: Reading,
    options: BuildOptions,
    previous?: Built,
): Promise<Built> {
    const declared = declare(doc, config);
    const variables = options.utilitiesOnly ? nothing : variablesFrom(declared, config);
    const utilities = options.variablesOnly
        ? nothing
        : await utilitiesFrom(declared, config, options.markup ?? true, previous);
    return {
        doc,
        folder,
        configFile,
        variables: variables.files,
        utilities: utilities.files,
        diagnostics: [...declared.diagnostics, ...variables.diagnostics, ...utilities.diagnostics],
        generator: utilities.generator,
    };
}

function variablesFrom(declared: Declarations, config: InternalConfig): Made {
    const { files, diagnostics } = emitCSS(declared, config);
    const { layer } = config.variables;
    return { files: finished(files, layer), diagnostics };
}

async function utilitiesFrom(
    declared: Declarations,
    config: InternalConfig,
    markup: boolean,
    previous: Built | undefined,
): Promise<Made> {
    const { classes } = config.utilities;
    if (!classes || Object.keys(classes).length === 0) return nothing;
    const { rules, starts, safelist, diagnostics } = utilityRules(utilityTokens(declared), classes);
    if (!markup) return { files: [], diagnostics };
    const kept = previous?.generator;
    if (kept && isDeepStrictEqual([kept.starts, kept.safelist], [starts, safelist])) {
        return { files: previous.utilities, diagnostics, generator: kept };
    }
    const uno = await createGenerator({
        presets: [{ name: "sugarcube", rules, preflights: [] }],
        safelist,
    });
    const generator = { starts, safelist, uno };
    return { files: await scanned(generator, config), diagnostics, generator };
}

async function scanned(generator: UtilityGenerator, config: InternalConfig) {
    const files = await utilitiesFromMarkup(generator.uno, generator.safelist, config);
    return finished(files, config.utilities.layer);
}

function finished(files: CSSFileOutput, layer: string | undefined): CSSFileOutput {
    return addBanner(layer ? wrapInLayer(files, layer) : files);
}
