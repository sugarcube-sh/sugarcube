type Props = {
    path: string;
    className?: string;
};

export function TokenPath({ path, className }: Props) {
    const wrapperClass = className ? `token-path ${className}` : "token-path";
    if (!path) return <span className={wrapperClass} />;

    const parts = path.split(".");

    if (parts.length === 1) {
        return (
            <span className={wrapperClass}>
                <span className="token-path-tail">{parts[0]}</span>
            </span>
        );
    }

    if (parts.length === 2) {
        return (
            <span className={wrapperClass}>
                <span className="token-path-ns">{parts[0]}</span>
                <span className="token-path-dot">.</span>
                <span className="token-path-tail">{parts[1]}</span>
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
                <span key={parts.slice(0, i + 2).join(".")}>
                    <span className="token-path-dot">.</span>
                    <span className="token-path-leaf">{segment}</span>
                </span>
            ))}
            <span className="token-path-dot">.</span>
            <span className={lastIsNum ? "token-path-num" : "token-path-tail"}>{last}</span>
        </span>
    );
}
