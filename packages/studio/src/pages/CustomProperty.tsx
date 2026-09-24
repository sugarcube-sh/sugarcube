"use client";

import { createVariableNameResolver } from "@sugarcube-sh/core/client";
import { useEffect, useMemo, useState } from "react";
import { useBaseline } from "../store/hooks";

export function CustomProperty({ path }: { path: string }) {
    const { config } = useBaseline();
    const [copied, setCopied] = useState(false);

    const property = useMemo(
        () => `--${createVariableNameResolver(config.variables)(path)}`,
        [config.variables, path],
    );

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1500);
        return () => window.clearTimeout(timer);
    }, [copied]);

    async function copy() {
        try {
            await navigator.clipboard.writeText(property);
            setCopied(true);
        } catch {
            // Clipboard denied or unavailable. The text stays selectable.
        }
    }

    return (
        <span className="cluster cluster-gap-100" data-cluster-wrap="nowrap">
            <code className="custom-property">{property}</code>
            <button type="button" className="button" data-role="tertiary" onClick={copy}>
                {copied ? "Copied" : "Copy"}
            </button>
        </span>
    );
}
