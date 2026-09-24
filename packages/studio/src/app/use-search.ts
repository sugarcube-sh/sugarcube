"use client";

import { useCallback, useEffect, useState } from "react";

/** `null` is closed. Anything else, including "", is open with that query. */
export function useSearch() {
    const [query, setQuery] = useState<string | null>(null);

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setQuery((current) => (current === null ? "" : null));
                return;
            }
            if (event.key === "Escape") setQuery(null);
        }

        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const close = useCallback(() => setQuery(null), []);

    return { query, setQuery, close };
}
