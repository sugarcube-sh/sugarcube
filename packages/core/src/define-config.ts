import type { SugarcubeConfig } from "./types/config.js";

/**
 * Define a sugarcube configuration with full type inference.
 *
 * @example
 * ```ts
 * // sugarcube.config.ts
 * import { defineConfig } from "@sugarcube-sh/cli";
 *
 * export default defineConfig({
 *   resolver: "./tokens/resolver.json",
 *   output: { cssRoot: "src/styles" }
 * });
 * ```
 */
export function defineConfig(config: SugarcubeConfig): SugarcubeConfig {
	return config;
}
