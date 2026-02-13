import { normalize } from "pathe";
import { ERROR_MESSAGES, RESERVED_DIRECTORIES } from "../constants/index.js";
import { CLIError } from "../types/index.js";

export function validateDirectoryPath(dirPath: string, optionName: string): void {
    if (!dirPath || dirPath.trim() === "") {
        throw new CLIError(ERROR_MESSAGES.DIRECTORY_PATH_EMPTY(optionName));
    }

    const normalizedPath = normalize(dirPath);

    const firstSegment = normalizedPath.split("/")[0];
    if (firstSegment && RESERVED_DIRECTORIES.includes(firstSegment as any)) {
        throw new CLIError(ERROR_MESSAGES.DIRECTORY_PATH_RESERVED(optionName, dirPath));
    }
}
