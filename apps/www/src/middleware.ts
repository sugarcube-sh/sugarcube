import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(({ url }, next) => {
    if (import.meta.env.DEV) return next();
    if (import.meta.env.PROD) return next();

    if (import.meta.env.PROD) {
        const pathname = url.pathname;

        if (pathname !== "/" && pathname !== "/index.html") {
            return Response.redirect(new URL("/", url), 302);
        }
    }

    return next();
});
