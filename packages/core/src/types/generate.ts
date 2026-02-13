export type CSSVariable = {
    name: string;
    value: string | number;
};

export type CSSVarSet = {
    vars: CSSVariable[];
    /** Feature variables for progressive enhancement (e.g., P3 colors). */
    features?: CSSFeatureBlock[];
};

export type CSSFeatureBlock = {
    query: string;
    vars: CSSVariable[];
};

export type CSSVariableBlocks = {
    root: {
        selector: string;
        vars: CSSVariable[];
    };
    features: CSSFeatureBlock[];
};

/**
 * A generated CSS file with its output path and content.
 */
export type CSSFile = {
    /** The file path where the CSS will be written. */
    path: string;
    /** The generated CSS content. */
    css: string;
};

export type SingleFileOutput = [CSSFile];

/**
 * Array of generated CSS files from the pipeline.
 * Each file contains a path and the CSS content to write.
 */
export type CSSFileOutput = CSSFile[];

export type CSSGenerationResult = {
    output: SingleFileOutput | CSSFileOutput;
};
