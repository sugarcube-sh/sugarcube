type Props = {
    path: string;
    className?: string;
};

// Highlight rules:
//   - 1 segment (e.g. `solid`): leaf only
//   - 2 segments (e.g. `color.white`): namespace dim, leaf normal — no accent
//   - 3+ segments: namespace dim, middle leaves normal, final segment accented
//     (the trailing segment is the distinguishing axis — step number or variant word)
export function TokenPath({ path, className }: Props) {
    const wrapperClass = className ? `token-path ${className}` : "token-path";
    if (!path) return <span className={wrapperClass} />;

    const parts = path.split(".");

    if (parts.length === 1) {
        return (
            <span className={wrapperClass}>
                <span className="token-path-leaf">{parts[0]}</span>
            </span>
        );
    }

    if (parts.length === 2) {
        return (
            <span className={wrapperClass}>
                <span className="token-path-ns">{parts[0]}</span>
                <span className="token-path-dot">.</span>
                <span className="token-path-leaf">{parts[1]}</span>
            </span>
        );
    }

    const ns = parts[0];
    const middle = parts.slice(1, -1);
    const last = parts[parts.length - 1] as string;
    const lastIsNum = /^\d+$/.test(last);

    return (
        <span className={wrapperClass}>
            <span className="token-path-ns">{ns}</span>
            {middle.map((segment, i) => (
                // oxlint-disable-line lint/suspicious/noArrayIndexKey: segments are positional and fixed
                <span key={i}>
                    <span className="token-path-dot">.</span>
                    <span className="token-path-leaf">{segment}</span>
                </span>
            ))}
            <span className="token-path-dot">.</span>
            <span className={lastIsNum ? "token-path-num" : "token-path-tail"}>{last}</span>
        </span>
    );
}
