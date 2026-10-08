import {
    type CSSFileOutput,
    type Declarations,
    type InternalConfig,
    type LoadedConfig,
    type Reported,
    declare,
    emitCSS,
    fillDefaults,
    readOptions,
    utilityRules,
    utilityTokens,
} from "@sugarcube-sh/core";
import { type Document, readFromMemory } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { createGenerator } from "@unocss/core";
import { dirname } from "pathe";
import { addBanner, utilitiesFromMarkup, wrapInLayer } from "./output.js";

export interface BuildOptions {
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

const nothing = { files: [], diagnostics: [] };

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
    const declared = declare(doc, config);
    const variables = options.utilitiesOnly ? nothing : variablesFrom(declared, config);
    const utilities = options.variablesOnly
        ? nothing
        : await utilitiesFrom(declared, config, options.markup ?? true);
    return {
        doc,
        folder,
        configFile,
        files: [...variables.files, ...utilities.files],
        diagnostics: [...declared.diagnostics, ...variables.diagnostics, ...utilities.diagnostics],
    };
}

function variablesFrom(declared: Declarations, config: InternalConfig) {
    const { files, diagnostics } = emitCSS(declared, config);
    const { layer } = config.variables;
    return { files: finished(files, layer), diagnostics };
}

async function utilitiesFrom(declared: Declarations, config: InternalConfig, markup: boolean) {
    const { classes, layer } = config.utilities;
    if (!classes || Object.keys(classes).length === 0) return nothing;
    const { rules, safelist, diagnostics } = utilityRules(utilityTokens(declared), classes);
    if (!markup) return { files: [], diagnostics };
    const generator = await createGenerator({
        presets: [{ name: "sugarcube", rules, preflights: [] }],
        safelist,
    });
    const files = await utilitiesFromMarkup(generator, safelist, config);
    return { files: finished(files, layer), diagnostics };
}

function finished(files: CSSFileOutput, layer: string | undefined): CSSFileOutput {
    return addBanner(layer ? wrapInLayer(files, layer) : files);
}
