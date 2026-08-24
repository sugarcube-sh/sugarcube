import { useScaleState } from "../../store/hooks";
import type { Adapter } from "../types";

export const linkAdapter =
    (token: string): Adapter<boolean> =>
    () => {
        const meta = useScaleState((state) => state.linkBindings[token]);
        const edit = useScaleState((state) => state.links[token]);
        const setLinkEnabled = useScaleState((state) => state.setLinkEnabled);

        function set(next: boolean) {
            setLinkEnabled(token, next);
        }

        return {
            value: meta ? (edit?.enabled ?? true) : undefined,
            set,
            commit: set,
            disabled: !meta,
        };
    };
