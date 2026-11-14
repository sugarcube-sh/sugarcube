import type { StudioMessage } from "../protocol";
import type { FilesSnapshot } from "./files";

export function toStudioMessage({ config, tokens, configProblems }: FilesSnapshot): StudioMessage {
    const { entryFile, files } = tokens.toMemory();
    return JSON.parse(
        JSON.stringify({
            adapter: { name: "sugarcube", settings: config, problems: configProblems },
            entryFile,
            files,
        }),
    );
}
