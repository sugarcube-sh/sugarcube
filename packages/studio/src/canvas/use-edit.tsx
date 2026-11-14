import type { OperationResult, Question, StepOptions } from "@sugarcube-sh/dtcg-edit";
import { type ReactNode, useState } from "react";
import { getReasons } from "../controllers/keyed-value";
import { useStudio, useStudioState } from "../providers/studio-context";
import { useKeyedState } from "./use-keyed-state";

export function useEdit(): {
    run(result: OperationResult, options?: StepOptions): boolean;
    view: ReactNode;
} {
    const studio = useStudio();
    const tokens = useStudioState((state) => state.tokens);
    const [question, setQuestion] = useKeyedState<Question>(tokens);
    const [reasons = [], setReasons] = useKeyedState<readonly string[]>(tokens);

    const run = (result: OperationResult, options?: StepOptions): boolean => {
        const commitResult = studio.do(result, options);
        setQuestion(commitResult.question, studio.state.tokens);
        setReasons(getReasons(commitResult), studio.state.tokens);
        return commitResult.tokens !== undefined;
    };

    return {
        run,
        view: (
            <>
                {question && (
                    <FilePicker
                        key={question.files.join()}
                        question={question}
                        onAnswer={(file) => run(question.answer(file))}
                    />
                )}
                {reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                ))}
            </>
        ),
    };
}

function FilePicker({ question, onAnswer }: { question: Question; onAnswer(file: string): void }) {
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
