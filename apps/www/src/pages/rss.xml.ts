import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { siteConfig } from "@/src/site.config";

export async function GET(context: APIContext) {
    const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
        (a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf(),
    );

    return rss({
        title: siteConfig.title,
        description: siteConfig.description,
        site: context.site ?? siteConfig.url,
        customData: `<language>${siteConfig.lang}</language>`,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.publishDate,
            link: `/blog/${post.id}/`,
        })),
    });
}
