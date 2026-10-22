import { useState } from "react";
import { type Held, heldFor } from "../controllers/held";

export function useHeld<T>(
    now: unknown,
): readonly [T | undefined, (value: T | undefined, about: unknown) => void] {
    const [held, setHeld] = useState<Held<T>>();
    const hold = (value: T | undefined, about: unknown) =>
        setHeld(value === undefined ? undefined : { value, about });
    return [heldFor(held, now), hold];
}
