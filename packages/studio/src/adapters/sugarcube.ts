import {
    type InternalConfig,
    generateCSS,
    createCSSWriterOptions,
    createReadOptions,
} from "@sugarcube-sh/core/client";
import { createCSSWriter } from "@sugarcube-sh/dtcg/css";
import type { BuildAdapter } from "../controllers/adapter";
import { sugarcubeForm } from "./sugarcube-forms";

export function sugarcube(config: InternalConfig): BuildAdapter {
    return {
        read: createReadOptions(config),
        formFor: sugarcubeForm,
        write(tokens) {
            const values = createCSSWriter({
                ...createCSSWriterOptions(tokens, config),
                references: "values",
            });
            const made = generateCSS(tokens, config, { utilities: false });
            return {
                value: (token) => values.getValue(token)?.css,
                css: made.variables.map((file) => file.css).join("\n"),
                problems: made.diagnostics,
            };
        },
    };
}
