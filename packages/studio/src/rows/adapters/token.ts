import { useMemo } from "react";
import {
    useCurrentContext,
    useHasPendingChange,
    usePathIndex,
    useToken,
    useTokenStore,
} from "../../store/hooks";
import { type ColorValue, colorValueToToken, readColorValue } from "../../tokens/color-value";
import type { Adapter, ControlState } from "../types";

function useTokenReset(token: string): Pick<ControlState<unknown>, "overridden" | "reset"> {
    const overridden = useHasPendingChange(token);
    const resetToken = useTokenStore((state) => state.resetToken);

    return {
        overridden,
        reset: overridden ? () => resetToken(token) : undefined,
    };
}

export const colorAdapter =
    (token: string): Adapter<ColorValue> =>
    () => {
        const [value, setValue] = useToken<string>(token);
        const pathIndex = usePathIndex();
        const context = useCurrentContext();
        const resettable = useTokenReset(token);

        const resolved = useTokenStore((state) => state.resolved);
        const color = useMemo(
            () => readColorValue(value, (path) => pathIndex.readValue(resolved, path, context)),
            [value, resolved, pathIndex, context],
        );

        function set(next: ColorValue) {
            setValue(colorValueToToken(next));
        }

        return {
            value: color,
            set,
            commit: set,
            disabled: value === undefined,
            ...resettable,
        };
    };

export const presetAdapter =
    (token: string): Adapter<string> =>
    () => {
        const [value, setValue] = useToken<string>(token);
        const resettable = useTokenReset(token);

        return {
            value,
            set: setValue,
            commit: setValue,
            disabled: value === undefined,
            ...resettable,
        };
    };
