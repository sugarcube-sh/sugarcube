// @ts-check
import mdx from "@astrojs/mdx";
import { satteri, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import studio from "@sugarcube-sh/studio/vite";
import sugarcube from "@sugarcube-sh/vite";
import presetWind3 from "@unocss/preset-wind3";
import robotsTxt from "astro-robots-txt";
import starlightLinksValidator from "starlight-links-validator";
import starlightSidebarTopics from "starlight-sidebar-topics";
import { defineConfig, fontProviders } from "astro/config";
import { fileURLToPath } from "node:url";
import { siteConfig } from "./src/site.config";
import { apiReference } from "./scripts/api-docs/integration.ts";
import { PAGES } from "./scripts/api-docs/pages.ts";

const entryPointPages = PAGES.filter((page) => page.entry).map(
    (page) => `dtcg/docs/reference/${page.slug}`,
);
const typePages = PAGES.filter((page) => !page.entry).map(
    (page) => `dtcg/docs/reference/${page.slug}`,
);

export default defineConfig({
    site: siteConfig.url,
    markdown: {
        processor: satteri({ hastPlugins: [satteriHeadingIdsPlugin()] }),
    },
    fonts: [
        {
            provider: fontProviders.google(),
            name: "Geist",
            cssVariable: "--font-geist",
            weights: ["100 900"],
            fallbacks: [
                "Inter",
                "-apple-system",
                "BlinkMacSystemFont",
                "Segoe UI",
                "Roboto",
                "Helvetica Neue",
                "Arial",
                "sans-serif",
            ],
        },
        {
            provider: fontProviders.google(),
            name: "Geist Mono",
            cssVariable: "--font-geist-mono",
            weights: ["100 900"],
            fallbacks: ["SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", "monospace"],
        },
    ],
    integrations: [
        apiReference(),
        sitemap(),
        robotsTxt(),
        react(),
        starlight({
            title: "sugarcube",
            titleDelimiter: "-",
            disable404Route: true,
            favicon: "/favicon.svg",
            customCss: ["virtual:sugarcube.css", "src/styles/index.css"],
            plugins: [
                starlightLinksValidator(),
                starlightSidebarTopics(
                    [
                        {
                            id: "sugarcube",
                            label: "sugarcube",
                            link: "/docs/introduction/",
                            items: [
                                {
                                    label: "Get started",
                                    items: [
                                        "docs/introduction",
                                        "docs/getting-started",
                                        "docs/advanced-setup",
                                        "docs/configuration",
                                        "docs/tokens",
                                        "docs/working-with-tokens",
                                        "docs/starter-kits",
                                        "docs/utilities",
                                        "docs/components",
                                        "docs/cube-css",
                                        "docs/working-with-cube-css",
                                        "docs/theming",
                                        "docs/resolver",
                                        "docs/fluid-space-and-type",
                                        "docs/color-formats",
                                        "docs/cascade-layers",
                                        "docs/editor-setup",
                                    ],
                                },
                                {
                                    label: "Integrations",
                                    items: [
                                        "docs/astro",
                                        "docs/sveltekit",
                                        "docs/vite",
                                        "docs/11ty",
                                        "docs/tanstack-start",
                                        "docs/nuxt",
                                    ],
                                },
                                {
                                    label: "Reference",
                                    items: [
                                        "docs/reference/configuration-schema",
                                        "docs/reference/cli-commands",
                                    ],
                                },
                                {
                                    label: "Components",
                                    items: [
                                        "docs/components/introduction",
                                        {
                                            label: "React",
                                            items: [
                                                "docs/components/react/accordion",
                                                "docs/components/react/alert",
                                                "docs/components/react/avatar",
                                                "docs/components/react/badge",
                                                "docs/components/react/button",
                                                "docs/components/react/card",
                                                "docs/components/react/checkbox",
                                                "docs/components/react/combobox",
                                                "docs/components/react/command",
                                                "docs/components/react/dialog",
                                                "docs/components/react/dropdown-menu",
                                                "docs/components/react/input",
                                                "docs/components/react/label",
                                                "docs/components/react/popover",
                                                "docs/components/react/radio-group",
                                                "docs/components/react/select",
                                                "docs/components/react/switch",
                                                "docs/components/react/tabs",
                                                "docs/components/react/textarea",
                                            ],
                                        },
                                        {
                                            label: "CSS-only",
                                            items: [
                                                "docs/components/css-only/accordion",
                                                "docs/components/css-only/alert",
                                                "docs/components/css-only/avatar",
                                                "docs/components/css-only/badge",
                                                "docs/components/css-only/button",
                                                "docs/components/css-only/card",
                                                "docs/components/css-only/checkbox",
                                                "docs/components/css-only/dialog",
                                                "docs/components/css-only/input",
                                                "docs/components/css-only/label",
                                                "docs/components/css-only/radio-group",
                                                "docs/components/css-only/select",
                                                "docs/components/css-only/switch",
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            id: "dtcg",
                            label: "dtcg",
                            link: "/dtcg/docs/getting-started/introduction/",
                            items: [
                                {
                                    label: "Get started",
                                    items: [
                                        {
                                            autogenerate: {
                                                directory: "dtcg/docs/getting-started",
                                            },
                                        },
                                    ],
                                },
                                {
                                    label: "Guides",
                                    items: [{ autogenerate: { directory: "dtcg/docs/guides" } }],
                                },
                                {
                                    label: "Concepts",
                                    items: [{ autogenerate: { directory: "dtcg/docs/concepts" } }],
                                },
                                {
                                    label: "Reference",
                                    items: [
                                        "dtcg/docs/reference/overview",
                                        { label: "Entry points", items: entryPointPages },
                                        { label: "Types", items: typePages },
                                    ],
                                },
                            ],
                        },
                    ],
                    {
                        topics: {
                            sugarcube: ["/docs/**", "/errors/**"],
                            dtcg: ["/dtcg/errors/**"],
                        },
                    },
                ),
            ],
            markdown: {
                headingLinks: false,
            },
            components: {
                Head: "./src/components/StarlightHead.astro",
                Header: "./src/components/DocsHeader.astro",
                PageTitle: "./src/components/DocsPageTitle.astro",
                Pagination: "./src/components/DocsPagination.astro",
                ThemeProvider: "./src/components/ThemeProvider.astro",
                ThemeSelect: "./src/components/EmptyThemeSelect.astro",
                MobileMenuFooter: "./src/components/MobileMenuFooter.astro",
            },
            expressiveCode: { themes: ["rose-pine"] },
        }),
        mdx(),
    ],
    vite: {
        resolve: {
            alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
        },
        plugins: [
            studio(),
            sugarcube({
                unoOptions: {
                    presets: [presetWind3({ preflight: false })],
                    blocklist: ["container"],
                    outputToCssLayers: {
                        cssLayerName: (layer) => {
                            if (layer === "preflights") return "theme";
                            if (layer === "default") return "utilities";
                            return layer;
                        },
                    },
                },
            }),
        ],
    },
    prefetch: true,
    devToolbar: {
        enabled: false,
    },
});
