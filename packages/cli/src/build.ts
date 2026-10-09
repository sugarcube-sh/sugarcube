import {
    type CSSFileOutput,
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
import { createGenerator } from "@unocss/core";
import { dirname } from "pathe";
import { addBanner, utilitiesFromMarkup, wrapInLayer } from "./output.js";

interface BuildOptions {
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
    markup?: boolean;
}

export interface Built {
    doc: Document;
    folder: string;
    configFile?: string;
    files: CSSFileOutput;
    diagnostics: Reported[];
}

interface Reading {
    doc: Document;
    folder: string;
    config: InternalConfig;
    configFile?: string;
}

export async function build(
    { config, configFile }: LoadedConfig,
    options: BuildOptions = {},
): Promise<Built> {
    const doc = await read(config.resolver, readOptions(config));
    return fromReading({ doc, folder: dirname(config.resolver), config, configFile }, options);
}

export function buildFiles(texts: Record<string, string>, folder: string): Promise<Built> {
    const config = fillDefaults({});
    const doc = readFromMemory({ files: texts }, readOptions(config));
    return fromReading({ doc, folder, config }, {});
}

async function fromReading(
    { doc, folder, config, configFile }: Reading,
    options: BuildOptions,
): Promise<Built> {
    const made = cssFrom(doc, config, {
        variables: !options.utilitiesOnly,
        utilities: !options.variablesOnly,
    });
    const markup = options.markup ?? true;
    const utilities = await utilitiesFrom(made.utilities, config, markup);
    return {
        doc,
        folder,
        configFile,
        files: [...finished(made.variables, config.variables.layer), ...utilities],
        diagnostics: made.diagnostics,
    };
}

async function utilitiesFrom(
    utilities: UtilityCSS | undefined,
    config: InternalConfig,
    markup: boolean,
): Promise<CSSFileOutput> {
    if (!utilities || !markup) return [];
    const { rules, safelist } = utilities;
    const generator = await createGenerator({
        presets: [{ name: "sugarcube", rules, preflights: [] }],
        safelist,
    });
    const files = await utilitiesFromMarkup(generator, safelist, config);
    return finished(files, config.utilities.layer);
}

function finished(files: CSSFileOutput, layer: string | undefined): CSSFileOutput {
    return addBanner(layer ? wrapInLayer(files, layer) : files);
}
