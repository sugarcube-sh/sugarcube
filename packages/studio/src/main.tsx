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

// ?mode=embedded means we're inside the <sugarcube-studio> web component.
// Otherwise we're in the DevTools dock.
const params = new URLSearchParams(window.location.search);
const source: TokenSource =
    params.get("mode") === "embedded" ? { mode: "embedded" } : { mode: "devtools" };

createRoot(rootEl).render(
    <StrictMode>
        <StudioProvider source={source}>
            <Shell />
        </StudioProvider>
    </StrictMode>
);
