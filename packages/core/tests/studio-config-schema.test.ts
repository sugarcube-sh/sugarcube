import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { userConfigSchema } from "../src/shared/schemas/config.js";

const parsed = (studio: unknown) => userConfigSchema.safeParse({ studio });

const issues = (result: ReturnType<typeof parsed>) =>
    result.success ? [] : result.error.issues.map((issue) => issue.message);

describe("studio's settings", () => {
    it("are where the tokens live on GitHub, whether Save is on, and where sign-in is", () => {
        const studio = {
            repository: "acme/site",
            branch: "main",
            app: "acme-studio",
            save: false,
            signIn: "/auth/studio",
        };
        expect(parsed(studio)).toMatchObject({ success: true, data: { studio } });
    });

    it("are all optional", () => {
        expect(parsed({}).success).toBe(true);
        expect(userConfigSchema.safeParse({}).success).toBe(true);
    });

    it.for(["acme", "acme/site/extra", "https://github.com/acme/site", "acme site"])(
        "refuse a repository written as %s, saying how to write it",
        (repository) => {
            expect(issues(parsed({ repository }))[0]).toContain('"owner/name"');
        },
    );

    it.for(["Acme Studio", "acme/studio", "acme-studio?x=1", "-acme"])(
        "refuse an app name GitHub wouldn't give, such as %s",
        (app) => {
            expect(issues(parsed({ app }))[0]).toContain("studio.app");
        },
    );

    it.for(["auth/studio", "//evil.example/auth", "https://acme.com/auth"])(
        "refuse a sign-in address that isn't a path on the site: %s",
        (signIn) => {
            expect(issues(parsed({ signIn }))[0]).toContain("/api/sugarcube-studio");
        },
    );

    it("reach the config every tool reads", () => {
        expect(fillDefaults({ studio: { repository: "acme/site" } }).studio).toStrictEqual({
            repository: "acme/site",
        });
    });
});
