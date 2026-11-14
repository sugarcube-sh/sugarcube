import { useState } from "react";
import { type KeyedValue, getValueForKey } from "../controllers/keyed-value";

export function useKeyedState<T>(
    currentKey: unknown,
): readonly [T | undefined, (value: T | undefined, key: unknown) => void] {
    const [keyed, setKeyed] = useState<KeyedValue<T>>();
    const setValue = (value: T | undefined, key: unknown) =>
        setKeyed(value === undefined ? undefined : { value, key });
    return [getValueForKey(keyed, currentKey), setValue];
}
