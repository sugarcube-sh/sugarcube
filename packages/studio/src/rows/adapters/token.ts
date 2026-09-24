import { useMemo } from "react";
import {
    useCurrentContext,
    useHasPendingChange,
    usePathIndex,
    useToken,
    useTokenStore,
} from "../../store/hooks";
import {
    type LiteralColor,
    readLiteralColor,
    sameColorValue,
    writeColor,
} from "../../tokens/color-shape";
import { type ColorValue, colorValueToToken, readColorValue } from "../../tokens/color-value";
import { readFontFamily, writeFontFamily } from "../../tokens/font-family";
import { readFontWeight, writeFontWeight } from "../../tokens/font-weight";
import { unwrapRef, wrapRef } from "../../tokens/paths";
import { readStrokeStyle } from "../../tokens/stroke-style";
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

export const literalColorAdapter =
    (token: string): Adapter<LiteralColor> =>
    () => {
        const [value, setValue] = useToken<unknown>(token);
        const resettable = useTokenReset(token);

        const color = useMemo(() => readLiteralColor(value), [value]);

        function set(next: LiteralColor) {
            const written = writeColor(next.shape, next.css);
            if (written === undefined || sameColorValue(written, value)) return;
            setValue(written);
        }

        return {
            value: color,
            set,
            commit: set,
            disabled: color === undefined,
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

type Dimensionish = { value: number; unit: string };

export const dimensionAdapter =
    (token: string): Adapter<number> =>
    () => {
        const [value, setValue] = useToken<Dimensionish>(token);
        const resettable = useTokenReset(token);

        function set(next: number) {
            if (!value) return;
            setValue({ ...value, value: next });
        }

        return {
            value: value?.value,
            set,
            commit: set,
            disabled: value === undefined,
            ...resettable,
        };
    };

export const numberAdapter =
    (token: string): Adapter<number> =>
    () => {
        const [value, setValue] = useToken<number>(token);
        const resettable = useTokenReset(token);

        return {
            value,
            set: setValue,
            commit: setValue,
            disabled: value === undefined,
            ...resettable,
        };
    };

export const fontWeightAdapter =
    (token: string): Adapter<string> =>
    () => {
        const [value, setValue] = useToken<unknown>(token);
        const resettable = useTokenReset(token);

        const weight = useMemo(() => readFontWeight(value), [value]);

        function set(next: string) {
            const parsed = Number.parseInt(next, 10);
            if (!weight || Number.isNaN(parsed) || parsed === weight.weight) return;
            setValue(writeFontWeight(weight.shape, parsed));
        }

        return {
            value: weight === undefined ? undefined : String(weight.weight),
            set,
            commit: set,
            disabled: weight === undefined,
            ...resettable,
        };
    };

export const strokeStyleAdapter =
    (token: string): Adapter<string> =>
    () => {
        const [value, setValue] = useToken<unknown>(token);
        const resettable = useTokenReset(token);

        const keyword = readStrokeStyle(value);

        return {
            value: keyword,
            set: setValue,
            commit: setValue,
            disabled: keyword === undefined,
            ...resettable,
        };
    };

export const fontFamilyAdapter =
    (token: string): Adapter<string> =>
    () => {
        const [value, setValue] = useToken<unknown>(token);
        const resettable = useTokenReset(token);

        const family = useMemo(() => readFontFamily(value), [value]);

        function set(next: string) {
            if (!family) return;
            const written = writeFontFamily(next, family.list);
            if (written === undefined) return;
            setValue(written);
        }

        return {
            value: family?.text,
            set,
            commit: set,
            disabled: family === undefined,
            ...resettable,
        };
    };

export const aliasAdapter =
    (token: string): Adapter<string> =>
    () => {
        const [value, setValue] = useToken<string>(token);
        const resettable = useTokenReset(token);

        function set(next: string) {
            setValue(wrapRef(next));
        }

        return {
            value: unwrapRef(value),
            set,
            commit: set,
            disabled: value === undefined,
            ...resettable,
        };
    };
