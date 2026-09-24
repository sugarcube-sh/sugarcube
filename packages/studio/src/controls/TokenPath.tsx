import { Fragment } from "react";
import { tokenPathSegments } from "../tokens/paths";

type Props = {
    path: string;
    className?: string;
};

export function TokenPath({ path, className }: Props) {
    const wrapperClass = className ? `token-path ${className}` : "token-path";
    const segments = tokenPathSegments(path);

    return (
        <span className={wrapperClass}>
            {segments.map((segment, i) => (
                <Fragment key={segment.path}>
                    {i > 0 && <span className="token-path-dot">.</span>}
                    <span className={`token-path-${segment.role}`}>{segment.text}</span>
                </Fragment>
            ))}
        </span>
    );
}
