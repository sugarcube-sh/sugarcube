import type { OpResult, Question, StepOptions } from "@sugarcube-sh/dtcg-edit";
import { type ReactNode, useState } from "react";
import { useStudio } from "../providers/studio-context";

export function useEdit(): {
    run(result: OpResult, options?: StepOptions): boolean;
    view: ReactNode;
} {
    const studio = useStudio();
    const [asking, setAsking] = useState<Question>();
    const [reasons, setReasons] = useState<readonly string[]>([]);

    const run = (result: OpResult, options?: StepOptions): boolean => {
        const done = studio.do(result, options);
        setAsking(done.question);
        setReasons(
            done.refused
                ? [done.refused.reason]
                : (done.conflicts ?? []).map((conflict) => conflict.reason),
        );
        return done.tokens !== undefined;
    };

    return {
        run,
        view: (
            <>
                {asking && (
                    <WhichFile
                        key={asking.files.join()}
                        question={asking}
                        onAnswer={(file) => run(asking.answer(file))}
                    />
                )}
                {reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                ))}
            </>
        ),
    };
}

function WhichFile({ question, onAnswer }: { question: Question; onAnswer(file: string): void }) {
    const [file, setFile] = useState(question.files[0] ?? "");

    return (
        <p>
            <label>
                Which file?{" "}
                <select value={file} onChange={(event) => setFile(event.target.value)}>
                    {question.files.map((each) => (
                        <option key={each} value={each}>
                            {each}
                        </option>
                    ))}
                </select>
            </label>{" "}
            <button type="button" onClick={() => onAnswer(file)}>
                Write
            </button>
        </p>
    );
}
