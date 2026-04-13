import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createHashRouter } from "react-router";
import { App } from "./App";
import { StudioProvider } from "./context";
import { Category } from "./routes/Category";
import { Overview } from "./routes/Overview";
import { TokenDetail } from "./routes/TokenDetail";
import "./app.css";

const router = createHashRouter([
    {
        path: "/",
        element: <App />,
        children: [
            { index: true, element: <Overview /> },
            { path: "system/*", element: <Category /> },
            { path: "token/*", element: <TokenDetail /> },
        ],
    },
]);

const rootEl = document.getElementById("root");
if (!rootEl) {
    throw new Error('Studio mount point "#root" not found in index.html');
}

createRoot(rootEl).render(
    <StrictMode>
        <StudioProvider>
            <RouterProvider router={router} />
        </StudioProvider>
    </StrictMode>
);
