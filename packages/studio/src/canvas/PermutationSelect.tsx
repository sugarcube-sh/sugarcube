import { useStudio, useStudioState } from "../providers/studio-context";

export function PermutationSelect() {
    const studio = useStudio();
    const tokens = useStudioState((state) => state.tokens);
    const showing = useStudioState((state) => state.shownPermutation);

    if (tokens.permutations.length < 2) return null;

    return (
        <p>
            <label>
                Showing{" "}
                <select
                    value={tokens.permutations.indexOf(showing)}
                    onChange={(event) => {
                        const permutation = tokens.permutations[Number(event.target.value)];
                        if (permutation) studio.show(permutation.input);
                    }}
                >
                    {tokens.permutations.map((permutation, index) => (
                        <option key={permutation.label} value={index}>
                            {permutation.label}
                        </option>
                    ))}
                </select>
            </label>
        </p>
    );
}
