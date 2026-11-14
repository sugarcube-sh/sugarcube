import { type ReactNode, useEffect, useState } from "react";
import type { SignIn } from "../controllers/sign-in";
import type { Studio } from "../controllers/studio";
import { ErrorMessages } from "../error-messages";
import { openStudio } from "../host/open-studio";
import { attachPageChannel } from "../host/page-channel";
import { connectStudio } from "./rpc-client";
import { SignInContext } from "./sign-in-context";
import { StudioContext } from "./studio-context";

type Props = {
    children: ReactNode;
};

type LoadState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; studio: Studio; signIn: SignIn | undefined };

export function StudioProvider({ children }: Props) {
    const [state, setState] = useState<LoadState>({ kind: "loading" });

    useEffect(() => {
        const controller = new AbortController();

        async function init() {
            try {
                const connection = await connectStudio(controller.signal);
                const studio = await openStudio(connection, controller.signal);
                if (!controller.signal.aborted)
                    setState({ kind: "ready", studio, signIn: connection.signIn });
            } catch (error) {
                if (controller.signal.aborted) return;
                setState({
                    kind: "error",
                    message: error instanceof Error ? error.message : ErrorMessages.CONNECT_FAILED,
                });
            }
        }

        init();
        return () => controller.abort();
    }, []);

    const studio = state.kind === "ready" ? state.studio : undefined;
    useEffect(() => (studio ? attachPageChannel(studio) : undefined), [studio]);

    if (state.kind === "error") {
        return (
            <div className="studio-error">
                <p>studio could not reach its host.</p>
                <p>Make sure the server that mounts studio is running, then reload.</p>
                <pre>{state.message}</pre>
            </div>
        );
    }

    if (state.kind === "loading") {
        return (
            <div className="studio-loading">
                <div>Loading studio...</div>
            </div>
        );
    }

    return (
        <StudioContext.Provider value={state.studio}>
            <SignInContext.Provider value={state.signIn}>{children}</SignInContext.Provider>
        </StudioContext.Provider>
    );
}
