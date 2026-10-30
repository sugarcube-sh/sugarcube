export const STUDIO_SIGN_IN_BASE = "/api/sugarcube-studio";

export const STUDIO_COOKIES = {
    key: "sugarcube-studio-key",
    login: "sugarcube-studio-login",
    refresh: "sugarcube-studio-refresh",
    state: "sugarcube-studio-state",
} as const;

export const STUDIO_SETTINGS = {
    clientId: "SUGARCUBE_STUDIO_GITHUB_CLIENT_ID",
    clientSecret: "SUGARCUBE_STUDIO_GITHUB_CLIENT_SECRET",
    secret: "SUGARCUBE_STUDIO_SECRET",
} as const;

export const STUDIO_BRANCH_PREFIX = "sugarcube-studio";

export const STUDIO_STORAGE = {
    unsaved: "sugarcube:studio:unsaved:",
    saveWaiting: "sugarcube:studio:save-waiting:",
} as const;

export const STUDIO_PAGE_CHANNEL = "sugarcube:studio:page";

export const STUDIO_RPC = {
    SAVE: "sugarcube:studio:save",
    MESSAGE: "sugarcube:studio:message",
    CONFIG: "sugarcube:studio",
} as const;

export const STUDIO_DEVFRAME_ID = "studio";

export const STUDIO_VITE_PLUGIN = "sugarcube:studio:files";

export const STUDIO_HUB_BASE = "/__sugarcube/";

export const STUDIO_ROUTE = "/__sugarcube/studio/";

export const STUDIO_DOCK_SCRIPT = "/__sugarcube/embedded.js";
