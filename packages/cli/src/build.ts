import {
    type CSSFileOutput,
    type Declarations,
    type InternalConfig,
    type Reported,
    declare,
    emitCSS,
    readOptions,
    utilityRules,
    utilityTokens,
} from "@sugarcube-sh/core";
import type { Document } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { createGenerator } from "@unocss/core";
import { CLIError } from "./cli-error.js";
import { ERROR_MESSAGES } from "./constants/error-messages.js";
import { addBanner, utilitiesFromMarkup, wrapInLayer } from "./output.js";

export interface BuildOptions {
    variablesOnly?: boolean;
    utilitiesOnly?: boolean;
}

export interface Built {
    doc: Document;
    files: CSSFileOutput;
    diagnostics: Reported[];
}

const nothing = { files: [], diagnostics: [] };

export async function build(config: InternalConfig, options: BuildOptions = {}): Promise<Built> {
    if (!config.resolver) throw new CLIError(ERROR_MESSAGES.RESOLVER_NOT_CONFIGURED());
    const doc = await read(config.resolver, readOptions(config));
    const declared = declare(doc, config);
    const variables = options.utilitiesOnly ? nothing : variablesFrom(declared, config);
    const utilities = options.variablesOnly ? nothing : await utilitiesFrom(declared, config);
    return {
        doc,
        files: [...variables.files, ...utilities.files],
        diagnostics: [...declared.diagnostics, ...variables.diagnostics, ...utilities.diagnostics],
    };
}

function variablesFrom(declared: Declarations, config: InternalConfig) {
    const { files, diagnostics } = emitCSS(declared, config);
    const { layer } = config.variables;
    return { files: finished(files, layer), diagnostics };
}

async function utilitiesFrom(declared: Declarations, config: InternalConfig) {
    const { classes, layer } = config.utilities;
    if (!classes || Object.keys(classes).length === 0) return nothing;
    const { rules, safelist, diagnostics } = utilityRules(utilityTokens(declared), classes);
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
