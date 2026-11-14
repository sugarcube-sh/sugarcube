import { useMemo } from "react";
import { NavLink } from "react-router";
import { toHref } from "../app/token-path";
import { toProblemRows } from "../controllers/views";
import { useStudioState } from "../providers/studio-context";

export function Problems() {
    const problems = useStudioState((state) => state.problems);
    const rows = useMemo(() => toProblemRows(problems), [problems]);
    if (rows.length === 0) return null;

    return (
        <section aria-label="Problems">
            <h2>Problems</h2>
            <ul>
                {rows.map((row) => (
                    <li key={`${row.location} ${row.kind} ${row.message} ${row.permutationLabel}`}>
                        {row.location && <code>{row.location}</code>} {row.severity}: {row.message}
                        {row.permutationLabel && ` (${row.permutationLabel})`}{" "}
                        <small>{row.kind}</small>
                        {row.paths && (
                            <p>
                                In:{" "}
                                {row.paths.map((path, index) => (
                                    <span key={path}>
                                        {index > 0 && ", "}
                                        <NavLink to={toHref(path)}>{path}</NavLink>
                                    </span>
                                ))}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
