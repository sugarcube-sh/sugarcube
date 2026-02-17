// @ts-check
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import sugarcube from "@sugarcube-sh/vite";
import robotsTxt from "astro-robots-txt";
import { defineConfig, fontProviders } from "astro/config";
import { siteConfig } from "./src/site.config";
import presetWind3 from "@unocss/preset-wind3";
import AutoImport from "astro-auto-import";
import starlight from "@astrojs/starlight";

export default defineConfig({
    site: siteConfig.url,
    experimental: {
        fonts: [
            {
                provider: fontProviders.google(),
                name: "Geist",
                cssVariable: "--font-geist",
                weights: ["100 900"],
            },
        ],
    },
    integrations: [
        AutoImport({
            imports: [
                "src/components/SourceCode.astro",
                "src/components/PackageManagerTabs.astro",
                "src/components/AnchorHeading.astro",
            ],
        }),
        sitemap(),
        robotsTxt(),
        react(),
        starlight({
            title: "sugarcube",
            disable404Route: true,
            favicon: '/favicon.svg',
            customCss: ["virtual:sugarcube.css", "src/styles/index.css"],
            sidebar: [
                {
                    label: "Get started",
                    items: [
                        "docs/about",
                        "docs/getting-started",
                        "docs/advanced-setup",
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
                        "docs/configuration",
                        "docs/editor-setup",
                    ],
                },
                {
                    label: "Integrations",
                    items: ["docs/astro", "docs/vite", "docs/11ty", "docs/tanstack-start"],
                },
                {
                    label: "Reference",
                    items: ["docs/reference/configuration-schema", "docs/reference/cli-commands"],
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
            markdown: {
                headingLinks: false,
            },
            components: {
                Head: "./src/components/StarlightHead.astro",
                Header: "./src/components/SiteHeader.astro",
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
        plugins: [sugarcube({ unoPresets: [presetWind3({ preflight: false })] })],
    },
    prefetch: true,
    devToolbar: {
        enabled: false,
    },
});
