"use client";

import type { ResolvedToken } from "@sugarcube-sh/core/client";
import { FieldReset } from "../inspector/Field";
import { rowsForToken } from "../inspector/node-rows";
import { renderControl } from "../rows/render-control";
import type { Control } from "../rows/types";
import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { TokenValue } from "./TokenValue";

function CanvasControl({ control, path }: { control: Control; path: string }) {
    const { state, element } = renderControl(control, path);

    return (
        <span className="token-editor-control">
            {element}
            {state.reset && (
                <FieldReset
                    onClick={state.reset}
                    aria-label={`Discard change to ${path}`}
                    title="Discard"
                />
            )}
        </span>
    );
}

export function TokenEditor({ token }: { token: ResolvedToken }) {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();

    const row = rowsForToken(token, { pathIndex, resolved, context })[0];
    if (!row) return <TokenValue token={token} />;

    return (
        <div className="token-editor">
            {row.controls.map((control, index) => (
                <CanvasControl key={`${row.key}#${index}`} control={control} path={token.$path} />
            ))}
        </div>
    );
}
