import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "virtual:sugarcube.css";
import "./styles/index.css";
import { StudioProvider } from "./providers/StudioProvider";
import type { TokenSource } from "./providers/token-source";
import { Shell } from "./shell/Shell";

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error('Studio mount point "#root" not found in index.html');
}

// ?mode=embedded means we're inside the <sugarcube-studio> web component;
// ?mode=devtools forces the DevTools dock. With no override, only a *top-level*
// page under the Vite dev server is the sandbox - Studio opened on its own for
// chrome-styling with HMR, rendering from its own tokens. Anything framed by a
// host with no explicit mode is the DevTools dock (RPC): that includes the dock
// even when its iframe is proxied to this dev server (import.meta.env.DEV true),
// so the frame check must win over the DEV check. The shipped bundle defaults
// to DevTools as before.
const params = new URLSearchParams(window.location.search);
const explicitMode = params.get("mode");
const isTopLevel = window.parent === window;
const source: TokenSource =
    explicitMode === "embedded"
        ? { mode: "embedded" }
        : explicitMode === "devtools"
          ? { mode: "devtools" }
          : isTopLevel && import.meta.env.DEV
            ? { mode: "sandbox" }
            : { mode: "devtools" };

createRoot(rootEl).render(
    <StrictMode>
        <StudioProvider source={source}>
            <Shell />
        </StudioProvider>
    </StrictMode>,
);
