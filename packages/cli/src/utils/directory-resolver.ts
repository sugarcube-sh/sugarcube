import { resolve } from "pathe";

export function resolveDirectoryFromFlag(flagValue: string): {
    absolute: string;
} {
    const absolute = resolve(process.cwd(), flagValue);
    return { absolute };
}
