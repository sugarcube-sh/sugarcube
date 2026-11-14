import { createContext, useContext, useSyncExternalStore } from "react";
import type { SignIn } from "../controllers/sign-in";

export const SignInContext = createContext<SignIn | undefined>(undefined);

const subscribeNone = () => () => {};

export function useSignIn(): SignIn | undefined {
    const signIn = useContext(SignInContext);
    useSyncExternalStore(signIn?.subscribe ?? subscribeNone, () => signIn?.state);
    return signIn;
}
