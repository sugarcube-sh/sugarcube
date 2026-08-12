import { siteConfig } from "@/src/site.config";

export function formatDate(date: Date) {
    return date.toLocaleDateString(siteConfig.date.locale, siteConfig.date.options);
}
