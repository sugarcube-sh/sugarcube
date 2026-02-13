import fs from "node:fs";
import path from "node:path";

export function extractSourceCode(filePath: string) {
    const resolvedPath = filePath.replace(/^@\/registry\//, "").replace(/^@/g, "");

    const fullPath = path.resolve("registry", resolvedPath);

    try {
        const content = fs.readFileSync(fullPath, "utf-8");
        return content;
    } catch (error) {
        console.warn(`Could not read file: ${fullPath}`);
        return "";
    }
}
