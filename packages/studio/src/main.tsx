import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "virtual:sugarcube.css";
import "./styles/index.css";
import { StudioProvider } from "./providers/StudioProvider";
import { RouterProvider } from "react-router";
import { createStudioRouter } from "./app/create-router";

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error('Studio mount point "#root" not found in index.html');
}

const router = createStudioRouter();

createRoot(rootEl).render(
    <StrictMode>
        <StudioProvider>
            <RouterProvider router={router} />
        </StudioProvider>
    </StrictMode>,
);
