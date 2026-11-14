import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "virtual:sugarcube.css";
import "./styles/index.css";
import { StudioProvider } from "./providers/StudioProvider";
import { RouterProvider } from "react-router";
import { createStudioRouter } from "./app/create-router";
import { ErrorMessages } from "./error-messages";

const rootElement = document.getElementById("root");
if (!rootElement) {
    throw new Error(ErrorMessages.NO_MOUNT_POINT);
}

const router = createStudioRouter();

createRoot(rootElement).render(
    <StrictMode>
        <StudioProvider>
            <RouterProvider router={router} />
        </StudioProvider>
    </StrictMode>,
);
