export function Select<C extends string>({
    label,
    value,
    options,
    optionLabels,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly C[];
    optionLabels?: Partial<Record<C, string>>;
    onChange(choice: C): void;
}) {
    return (
        <select
            aria-label={label}
            value={value}
            onChange={(event) => {
                const choice = options.find((each) => each === event.target.value);
                if (choice !== undefined) onChange(choice);
            }}
        >
            {value === "" && <option value="">Choose</option>}
            {options.map((each) => (
                <option key={each} value={each}>
                    {optionLabels?.[each] ?? each}
                </option>
            ))}
        </select>
    );
}
