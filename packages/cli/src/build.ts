import { isDeepStrictEqual } from "node:util";
import {
    type CSSFileOutput,
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
    return { ...built, utilities: await scanned(built.generator, built.config) };
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
        variables: finished(made.variables, config.variables.layer),
        utilities: utilities.files,
        diagnostics: made.diagnostics,
        generator: utilities.generator,
    };
}

async function utilitiesFrom(
    utilities: UtilityCSS | undefined,
    config: InternalConfig,
    markup: boolean,
    previous: Built | undefined,
): Promise<{ files: CSSFileOutput; generator?: UtilityGenerator }> {
    if (!utilities || !markup) return { files: [] };
    const { rules, starts, safelist } = utilities;
    if (previous?.generator && previous.config === config) {
        const { generator, utilities: files } = previous;
        const same = isDeepStrictEqual([generator.starts, generator.safelist], [starts, safelist]);
        if (same) return { files, generator };
    }
    const uno = await createGenerator({
        presets: [{ name: "sugarcube", rules, preflights: [] }],
        safelist,
    });
    const generator = { starts, safelist, uno };
    return { files: await scanned(generator, config), generator };
}

async function scanned(generator: UtilityGenerator, config: InternalConfig) {
    const files = await utilitiesFromMarkup(generator.uno, generator.safelist, config);
    return finished(files, config.utilities.layer);
}

function finished(files: CSSFileOutput, layer: string | undefined): CSSFileOutput {
    return addBanner(layer ? wrapInLayer(files, layer) : files);
}
