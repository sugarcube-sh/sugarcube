"use client";

import { useCallback, useEffect, useState } from "react";

export function useSearch() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen((current) => !current);
                return;
            }
            if (event.key === "Escape") setOpen(false);
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const close = useCallback(() => setOpen(false), []);

    return { open, close };
}
