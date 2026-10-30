import { createContext, useContext, useSyncExternalStore } from "react";
import type { SignIn } from "../controllers/sign-in";

export const SignInContext = createContext<SignIn | undefined>(undefined);

const noChanges = () => () => {};

export function useSignIn(): SignIn | undefined {
    const signIn = useContext(SignInContext);
    useSyncExternalStore(signIn?.subscribe ?? noChanges, () => signIn?.state);
    return signIn;
}
