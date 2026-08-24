"use client";

type TokenTextProps = {
    path: string;
};

function TokenText({ path }: TokenTextProps) {
    const split = path.lastIndexOf(".");
    const prefix = split === -1 ? "" : path.slice(0, split + 1);
    const leaf = split === -1 ? path : path.slice(split + 1);

    return (
        <span data-slot="token-text" className="token-text">
            {prefix ? <span className="token-text-prefix">{prefix}</span> : null}
            <span className="token-text-leaf">{leaf}</span>
        </span>
    );
}

export { TokenText };
export type { TokenTextProps };
