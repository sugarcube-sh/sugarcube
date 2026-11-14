import type { Token } from "@sugarcube-sh/dtcg";
import { NavLink } from "react-router";
import { toHref } from "../app/token-path";
import { type GenerationSource, getTokenPageView } from "../controllers/token-page";
import { useStudioState } from "../providers/studio-context";
import { EditRow } from "./EditRow";
import { ExtensionFields } from "./ExtensionFields";
import { DeprecatedLine, DeprecationRow, DescriptionRow } from "./Properties";
import { PermutationSelect } from "./PermutationSelect";
import { useDraft } from "./use-draft";
import { NodeActions } from "./NodeActions";
import { CSSValue } from "./Value";

export function TokenPage({ token, isShown }: { token: Token; isShown: boolean }) {
    const state = useStudioState((each) => each);
    const [overridesToAdd, setOverridesToAdd] = useDraft<readonly string[]>([], token.path);
    const page = getTokenPageView(state, token, overridesToAdd);

    return (
        <article>
            <h1>{token.path}</h1>
            {page.deprecation.notice && <DeprecatedLine line={page.deprecation.notice} />}
            <PermutationSelect />
            {page.generatedBy && <GenerationSourceLine generatedBy={page.generatedBy} />}
            {page.form && (
                <ExtensionFields path={token.path} form={page.form} rowName={undefined} />
            )}
            <dl>
                <DescriptionRow path={token.path} view={page.description} />
                {page.deprecation.checkbox && (
                    <DeprecationRow path={token.path} box={page.deprecation.checkbox} />
                )}
                <dt>Type</dt>
                <dd>{token.type}</dd>
                {page.rows.map((each) => (
                    <EditRow
                        key={each.key}
                        row={each}
                        type={token.type}
                        path={token.path}
                        form={each.form}
                    />
                ))}
                {page.problems.length > 0 && (
                    <>
                        <dt>Problems</dt>
                        <dd>
                            <ul>
                                {page.problems.map((problem) => (
                                    <li
                                        key={`${problem.kind} ${problem.message} ${problem.permutationLabel}`}
                                    >
                                        {problem.message}
                                        {problem.permutationLabel &&
                                            ` (${problem.permutationLabel})`}
                                    </li>
                                ))}
                            </ul>
                        </dd>
                    </>
                )}
                <dt>CSS</dt>
                <dd>
                    {isShown ? (
                        <CSSValue type={page.row.type} css={page.row.css} />
                    ) : (
                        <>Not in {state.shownPermutation.label}</>
                    )}
                </dd>
            </dl>
            {page.overridableContexts.map((label) => (
                <button
                    key={label}
                    type="button"
                    onClick={() => setOverridesToAdd([...overridesToAdd, label])}
                >
                    Override for {label}
                </button>
            ))}
            {page.editable && <NodeActions path={token.path} />}
        </article>
    );
}

function GenerationSourceLine({ generatedBy }: { generatedBy: GenerationSource }) {
    switch (generatedBy.kind) {
        case "recipe":
            return (
                <p>
                    Made by the {generatedBy.by} on{" "}
                    <NavLink to={toHref(generatedBy.from)}>{generatedBy.from}</NavLink>.
                </p>
            );
        case "group":
            return (
                <p>
                    Made by <NavLink to={toHref(generatedBy.from)}>{generatedBy.from}</NavLink>.
                </p>
            );
        case "top-level":
            return <p>Made by a recipe at the top of its file.</p>;
    }
}
