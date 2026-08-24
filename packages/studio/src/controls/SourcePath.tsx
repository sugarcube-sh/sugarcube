type Props = {
    path: string;
    id?: string;
    className?: string;
};

export function SourcePath({ path, id, className }: Props) {
    const wrapperClass = className ? `source-path ${className}` : "source-path";
    const cut = path.lastIndexOf("/");

    if (cut === -1) {
        return (
            <span id={id} className={wrapperClass}>
                <span className="source-path-name">{path}</span>
            </span>
        );
    }

    return (
        <span id={id} className={wrapperClass}>
            <span className="source-path-dir">{path.slice(0, cut)}</span>
            <span className="source-path-name">
                <span className="source-path-sep">/</span>
                {path.slice(cut + 1)}
            </span>
        </span>
    );
}
