import { describe, expect, it } from "vitest";
import {
    STUDIO_BRANCH_PREFIX,
    STUDIO_COOKIES,
    STUDIO_DEVFRAME_ID,
    STUDIO_PAGE_CHANNEL,
    STUDIO_ROUTE,
    STUDIO_RPC,
    STUDIO_SETTINGS,
    STUDIO_SIGN_IN_BASE,
    STUDIO_STORAGE,
    STUDIO_VITE_PLUGIN,
} from "../src/studio-names";

describe("the names studio puts where it shares space with others", () => {
    it("are sugarcube-studio, in each place's own style", () => {
        expect({
            STUDIO_SIGN_IN_BASE,
            STUDIO_COOKIES,
            STUDIO_SETTINGS,
            STUDIO_BRANCH_PREFIX,
            STUDIO_STORAGE,
            STUDIO_PAGE_CHANNEL,
            STUDIO_RPC,
            STUDIO_DEVFRAME_ID,
            STUDIO_VITE_PLUGIN,
            STUDIO_ROUTE,
        }).toStrictEqual({
            STUDIO_SIGN_IN_BASE: "/api/sugarcube-studio",
            STUDIO_COOKIES: {
                key: "sugarcube-studio-key",
                login: "sugarcube-studio-login",
                refresh: "sugarcube-studio-refresh",
                state: "sugarcube-studio-state",
            },
            STUDIO_SETTINGS: {
                clientId: "SUGARCUBE_STUDIO_GITHUB_CLIENT_ID",
                clientSecret: "SUGARCUBE_STUDIO_GITHUB_CLIENT_SECRET",
                secret: "SUGARCUBE_STUDIO_SECRET",
            },
            STUDIO_BRANCH_PREFIX: "sugarcube-studio",
            STUDIO_STORAGE: {
                unsaved: "sugarcube:studio:unsaved:",
                saveWaiting: "sugarcube:studio:save-waiting:",
            },
            STUDIO_PAGE_CHANNEL: "sugarcube:studio:page",
            STUDIO_RPC: {
                SAVE: "sugarcube:studio:save",
                MESSAGE: "sugarcube:studio:message",
                CONFIG: "sugarcube:studio",
            },
            STUDIO_DEVFRAME_ID: "sugarcube-studio",
            STUDIO_VITE_PLUGIN: "sugarcube:studio:files",
            STUDIO_ROUTE: "/__studio/",
        });
    });
});
