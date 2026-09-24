import { NavLink } from "react-router";
import { stepLabel } from "../tokens/paths";
import type { TokenRun } from "../tokens/sections";

export function SwatchRun({
    run,
    columns,
    cssFor,
    hrefFor,
}: {
    run: TokenRun;
    columns: number;
    cssFor: (path: string) => string | undefined;
    hrefFor: (path: string) => string;
}) {
    return (
        <section className="swatch-run flow">
            {run.name && <h2 className="swatch-run-title">{run.name}</h2>}
            <ol
                className="swatch-run-steps"
                style={{ "--swatch-run-columns": columns } as React.CSSProperties}
            >
                {run.tokens.map((token) => (
                    <li key={token.$path}>
                        <NavLink className="swatch-step" to={hrefFor(token.$path)}>
                            <span
                                className="swatch-step-color"
                                style={{ background: cssFor(token.$path) }}
                            />
                            <span className="swatch-step-label">{stepLabel(token.$path)}</span>
                        </NavLink>
                    </li>
                ))}
            </ol>
        </section>
    );
}
