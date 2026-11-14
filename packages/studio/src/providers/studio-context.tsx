import { createContext, useContext, useSyncExternalStore } from "react";
import type { Studio, StudioState } from "../controllers/studio";
import { ErrorMessages } from "../error-messages";

export const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
    const studio = useContext(StudioContext);
    if (!studio) throw new Error(ErrorMessages.NO_STUDIO_PROVIDER);
    return studio;
}

export function useStudioState<T>(select: (state: StudioState) => T): T {
    const studio = useStudio();
    return useSyncExternalStore(studio.subscribe, () => select(studio.state));
}
