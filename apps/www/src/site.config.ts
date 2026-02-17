import type { SiteConfig } from "./types";

export const siteConfig: SiteConfig = {
    author: "Mark Tomlinson",
    date: {
        locale: "en-GB",
        options: {
            day: "numeric",
            month: "short",
            year: "numeric",
        },
    },
    description:
        "Design tokens, generated CSS, and optional components. Build front ends on strong, reusable foundations.",
    lang: "en-GB",
    ogImage: "/social-card.png",
    ogLocale: "en_GB",
    title: "sugarcube",
    url: "https://sugarcube.sh/",
};
