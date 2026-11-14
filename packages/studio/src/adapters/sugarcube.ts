import {
    type InternalConfig,
    generateCSS,
    createCSSWriterOptions,
    createReadOptions,
} from "@sugarcube-sh/core/client";
import { createCSSWriter } from "@sugarcube-sh/dtcg/css";
import type { BuildAdapter } from "../controllers/adapter";
import { getSugarcubeForm } from "./sugarcube-forms";

export function createSugarcubeAdapter(config: InternalConfig): BuildAdapter {
    return {
        readOptions: createReadOptions(config),
        getForm: getSugarcubeForm,
        write(tokens) {
            const values = createCSSWriter({
                ...createCSSWriterOptions(tokens, config),
                references: "values",
            });
            const output = generateCSS(tokens, config, { utilities: false });
            return {
                getValue: (token) => values.getValue(token)?.css,
                css: output.variables.map((file) => file.css).join("\n"),
                problems: output.diagnostics,
            };
        },
    };
}
