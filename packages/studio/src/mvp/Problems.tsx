import type { Handle } from "../tokens/path-index";
import { useProblems } from "./use-group";

export function ProblemList({ handle }: { handle: Handle }) {
    const problems = useProblems(handle);
    if (problems.length === 0) return null;

    return (
        <ul aria-label="Problems">
            {problems.map((problem) => (
                <li key={`${problem.kind}\u0000${problem.message}`}>{problem.message}</li>
            ))}
        </ul>
    );
}

export function ProblemMarker({ handle }: { handle: Handle }) {
    const problems = useProblems(handle);
    if (problems.length === 0) return null;

    return (
        <output aria-label={`${problems.length} problem`}>
            {" ⚠ "}
            {problems[0]?.message}
        </output>
    );
}
