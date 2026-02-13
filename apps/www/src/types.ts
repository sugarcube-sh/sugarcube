export interface SiteConfig {
    author: string;
    date: {
        locale: string | string[] | undefined;
        options: Intl.DateTimeFormatOptions;
    };
    description: string;
    lang: string;
    ogLocale: string;
    title: string;
    url: string;
}

export interface SiteMeta {
    articleDate?: string | undefined;
    description?: string;
    ogImage?: string | undefined;
    title: string;
}
