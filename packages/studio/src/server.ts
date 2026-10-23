export { STUDIO_SURFACE, defineStudio } from "./server/define-studio";
export { STUDIO_ROUTE, STUDIO_VITE_PLUGIN } from "./studio-names";
export type {
    DefineStudioOptions,
    StudioHostBridge,
    StudioSharedState,
    StudioSurface,
} from "./server/types";
export { studioDevframe } from "./server/definition";
export type { StudioDevframeOptions } from "./server/definition";
export { STUDIO_ICON } from "./server/icon";
export type { FilesNow, StudioFiles } from "./server/files";
export { nodeFiles, projectFiles, refuseEmpty } from "./server/node-files";
export { studioMessage } from "./server/message";
export type { SaveOutcome } from "./protocol";
export type { StudioConnectionConfig, StudioMessage } from "./protocol";
export { ErrorMessages, STUDIO_NAME } from "./error-messages";
