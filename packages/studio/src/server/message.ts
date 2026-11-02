import type { StudioMessage } from "../protocol";
import type { FilesNow } from "./files";

export function studioMessage({ config, tokens, configProblems }: FilesNow): StudioMessage {
    const { entryFile, files } = tokens.toMemory();
    return JSON.parse(
        JSON.stringify({
            adapter: { name: "sugarcube", settings: config, problems: configProblems },
            entryFile,
            files,
        }),
    );
}
