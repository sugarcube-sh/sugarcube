import {
    type InternalConfig,
    cssFrom,
    cssWriterOptions,
    readOptions,
} from "@sugarcube-sh/core/client";
import { cssWriter } from "@sugarcube-sh/dtcg/css";
import type { BuildAdapter } from "../controllers/adapter";
import { sugarcubeForm } from "./sugarcube-forms";

export function sugarcube(config: InternalConfig): BuildAdapter {
    return {
        read: readOptions(config),
        formFor: sugarcubeForm,
        write(tokens) {
            const values = cssWriter({ ...cssWriterOptions(tokens, config), references: "values" });
            const made = cssFrom(tokens, config, { utilities: false });
            return {
                value: (token) => values.written(token)?.css,
                css: made.variables.map((file) => file.css).join("\n"),
                problems: made.diagnostics,
            };
        },
    };
}
