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
    description: "The toolkit for seriously sweet front ends.",
    lang: "en-GB",
    ogImage: "/social-card.png",
    ogLocale: "en_GB",
    title: "sugarcube",
    url: "https://sugarcube.sh/",
};
