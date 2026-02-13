import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    getFrameworkDisplayName,
    getProjectInfo,
    shouldInstallVitePlugin,
} from "../src/detection/framework.js";

const testDir = join(process.cwd(), "test-fixtures");

function createTestProject(structure: Record<string, string | object>) {
    function createStructure(obj: Record<string, string | object>, basePath: string) {
        for (const [key, value] of Object.entries(obj)) {
            const fullPath = join(basePath, key);

            if (typeof value === "string") {
                writeFileSync(fullPath, value);
            } else {
                mkdirSync(fullPath, { recursive: true });
                if (value && typeof value === "object") {
                    createStructure(value as Record<string, string | object>, fullPath);
                }
            }
        }
    }

    mkdirSync(testDir, { recursive: true });
    createStructure(structure, testDir);
}

describe("Framework Detection", () => {
    beforeEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe("Next.js Detection", () => {
        it("detects Next.js App Router", () => {
            createTestProject({
                "app": {
                    "page.tsx": "export default function Page() { return <div>Hello</div> }",
                },
                "package.json": JSON.stringify({
                    dependencies: { next: "^14.0.0", react: "^18.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("next-app");
            expect(result.tokensDir).toBe("design-tokens");
            expect(result.stylesDir).toBe("styles");
            expect(result.isSrcDir).toBe(false);
        });

        it("detects Next.js Pages Router", () => {
            createTestProject({
                "pages": {
                    "index.tsx": "export default function Page() { return <div>Hello</div> }",
                },
                "package.json": JSON.stringify({
                    dependencies: { next: "^13.0.0", react: "^18.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("next-pages");
            expect(result.tokensDir).toBe("design-tokens");
            expect(result.stylesDir).toBe("styles");
        });

        it("detects Next.js with src directory", () => {
            createTestProject({
                "src": {
                    "app": {
                        "page.tsx": "export default function Page() { return <div>Hello</div> }",
                    },
                },
                "package.json": JSON.stringify({
                    dependencies: { next: "^14.0.0", react: "^18.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("next-app");
            expect(result.isSrcDir).toBe(true);
        });
    });

    describe("Astro Detection", () => {
        it("detects Astro projects", () => {
            createTestProject({
                "src": {
                    "pages": {
                        "index.astro": "<html><body>Hello</body></html>",
                    },
                },
                "package.json": JSON.stringify({
                    dependencies: { astro: "^4.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("astro");
            expect(result.tokensDir).toBe("src/design-tokens");
            expect(result.stylesDir).toBe("src/styles");
            expect(result.isSrcDir).toBe(true);
        });
    });

    describe("Vite Detection", () => {
        it("detects Vite projects with config file", () => {
            createTestProject({
                "vite.config.ts": "export default {}",
                "src": {
                    "main.tsx": 'import React from "react"',
                },
                "package.json": JSON.stringify({
                    dependencies: { react: "^18.0.0" },
                    devDependencies: { vite: "^5.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("vite");
            expect(result.tokensDir).toBe("src/design-tokens");
            expect(result.stylesDir).toBe("src/styles");
        });

        it("detects vanilla Vite projects without config file", () => {
            // This is the default scaffolding from `npm create vite@latest`
            createTestProject({
                "src": {
                    "main.ts": 'console.log("hello")',
                },
                "package.json": JSON.stringify({
                    devDependencies: { vite: "^7.2.4", typescript: "~5.9.3" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("vite");
            expect(result.tokensDir).toBe("src/design-tokens");
            expect(result.stylesDir).toBe("src/styles");
        });
    });

    describe("Nuxt Detection", () => {
        it("detects Nuxt projects", () => {
            createTestProject({
                "pages": {
                    "index.vue": "<template><div>Hello</div></template>",
                },
                "package.json": JSON.stringify({
                    dependencies: { nuxt: "^3.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("nuxt");
            expect(result.tokensDir).toBe("design-tokens");
            expect(result.stylesDir).toBe("styles");
            expect(result.componentDir).toBe("components");
        });
    });

    describe("SvelteKit Detection", () => {
        it("detects SvelteKit projects", () => {
            createTestProject({
                "src": {
                    "routes": {
                        "+page.svelte": "<h1>Hello</h1>",
                    },
                },
                "package.json": JSON.stringify({
                    dependencies: { "@sveltejs/kit": "^2.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("sveltekit");
            expect(result.tokensDir).toBe("src/design-tokens");
            expect(result.stylesDir).toBe("src/styles");
        });
    });

    describe("Remix Detection", () => {
        it("detects Remix projects", () => {
            createTestProject({
                "package.json": JSON.stringify({
                    dependencies: { "@remix-run/node": "^2.0.0", "@remix-run/react": "^2.0.0" },
                }),
                "app": {
                    "root.tsx": "export default function App() {}",
                },
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("remix");
            expect(result.tokensDir).toBe("design-tokens");
            expect(result.stylesDir).toBe("styles");
        });
    });

    describe("Eleventy Detection", () => {
        it("detects Eleventy projects", () => {
            createTestProject({
                "src": {
                    "index.md": "# Hello World",
                },
                "package.json": JSON.stringify({
                    dependencies: { "@11ty/eleventy": "^2.0.0" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("eleventy");
            expect(result.tokensDir).toBe("src/design-tokens");
            expect(result.stylesDir).toBe("src/styles");
        });

        it("detects Eleventy with Vite and installs Vite plugin", () => {
            createTestProject({
                "package.json": JSON.stringify({
                    dependencies: {
                        "vite": "^7.3.1",
                        "@11ty/eleventy-plugin-vite": "^7.0.0",
                        "@11ty/eleventy": "^3.1.2",
                    },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("eleventy");
            expect(shouldInstallVitePlugin(result.framework, testDir)).toBe(true);
        });

        it("does not install Vite plugin for Eleventy without Vite", () => {
            createTestProject({
                "package.json": JSON.stringify({
                    dependencies: { "@11ty/eleventy": "^3.1.2" },
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("eleventy");
            expect(shouldInstallVitePlugin(result.framework, testDir)).toBe(false);
        });
    });

    describe("No Framework Detection", () => {
        it("falls back to none for unknown projects", () => {
            createTestProject({
                "src": {
                    "index.html": "<html><body>Hello</body></html>",
                },
                "package.json": JSON.stringify({
                    dependencies: {},
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("none");
            expect(result.tokensDir).toBe("src/design-tokens");
            expect(result.stylesDir).toBe("src/styles");
            expect(result.isSrcDir).toBe(true);
        });

        it("handles projects without src directory", () => {
            createTestProject({
                "index.html": "<html><body>Hello</body></html>",
                "package.json": JSON.stringify({
                    dependencies: {},
                }),
            });

            const result = getProjectInfo(testDir);

            expect(result.framework).toBe("none");
            expect(result.tokensDir).toBe("design-tokens");
            expect(result.stylesDir).toBe("styles");
            expect(result.isSrcDir).toBe(false);
        });
    });

    describe("Framework Display Names", () => {
        it("returns correct display names", () => {
            expect(getFrameworkDisplayName("next-app")).toBe("Next.js (App Router)");
            expect(getFrameworkDisplayName("next-pages")).toBe("Next.js (Pages Router)");
            expect(getFrameworkDisplayName("astro")).toBe("Astro");
            expect(getFrameworkDisplayName("vite")).toBe("Vite");
            expect(getFrameworkDisplayName("nuxt")).toBe("Nuxt");
            expect(getFrameworkDisplayName("sveltekit")).toBe("SvelteKit");
            expect(getFrameworkDisplayName("remix")).toBe("Remix");
            expect(getFrameworkDisplayName("eleventy")).toBe("11ty (Eleventy)");
            expect(getFrameworkDisplayName("none")).toBe("No framework");
        });
    });
});
