import type { OverwriteWarnings } from "../types/index.js";

export function formatOverwriteWarnings(warnings: OverwriteWarnings): string | undefined {
    const sections: string[] = [];

    if (warnings.variableCSS.length > 0) {
        sections.push(
            `CSS variables files:\n${warnings.variableCSS
                .map((f: string) => `  - ${f}`)
                .join("\n")}`
        );
    }

    if (warnings.utilityCSS.length > 0) {
        sections.push(
            `CSS utility files:\n${warnings.utilityCSS.map((f: string) => `  - ${f}`).join("\n")}`
        );
    }

    if (warnings.cubeCSS.length > 0) {
        sections.push(
            `CUBE CSS files:\n${warnings.cubeCSS.map((f: string) => `  - ${f}`).join("\n")}`
        );
    }

    if (warnings.componentFiles.length > 0 || warnings.componentCSS.length > 0) {
        const allComponentFiles = [...warnings.componentFiles, ...warnings.componentCSS];
        sections.push(
            `Component files:\n${allComponentFiles.map((f: string) => `  - ${f}`).join("\n")}`
        );
    }

    if (warnings.indexFiles.length > 0) {
        sections.push(
            `Index files:\n${warnings.indexFiles.map((f: string) => `  - ${f}`).join("\n")}`
        );
    }

    if (sections.length === 0) {
        return undefined;
    }

    const message = `The following file(s) already exist and will be overwritten:\n\n${sections.join(
        "\n\n"
    )}`;
    return message;
}
