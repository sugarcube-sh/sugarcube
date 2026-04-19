import type { ReactNode } from "react";
import { DevToolsTokenProvider } from "./DevToolsTokenProvider";
import { EmbeddedTokenProvider } from "./EmbeddedTokenProvider";
import type { TokenSource } from "./token-source";

export { useStudioConfig, useStudioMode } from "../store/hooks";

type Props = {
    source: TokenSource;
    children: ReactNode;
};

/**
 * Top-level Studio provider. Routes to the correct mode-specific provider
 * based on how Studio was launched:
 *
 *   - devtools:  Vite DevTools dock. Server owns the pipeline, edits via RPC.
 *   - embedded:  Web component iframe. Browser owns the pipeline, edits via postMessage.
 */
export function StudioProvider({ source, children }: Props) {
    switch (source.mode) {
        case "devtools":
            return <DevToolsTokenProvider>{children}</DevToolsTokenProvider>;
        case "embedded":
            return <EmbeddedTokenProvider>{children}</EmbeddedTokenProvider>;
    }
}
