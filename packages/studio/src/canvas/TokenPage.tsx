import type { Token } from "@sugarcube-sh/dtcg";
import { NavLink } from "react-router";
import { hrefFor } from "../app/token-path";
import { type MadeBy, tokenPage } from "../controllers/token-page";
import { useStudioState } from "../providers/studio-context";
import { EditRow } from "./EditRow";
import { ExtensionFields } from "./ExtensionFields";
import { DeprecatedLine, DeprecationRow, DescriptionRow } from "./Properties";
import { Showing } from "./Showing";
import { useDraft } from "./use-draft";
import { NodeActions } from "./NodeActions";
import { AsCSS } from "./Value";

export function TokenPage({ token, shown }: { token: Token; shown: boolean }) {
    const state = useStudioState((each) => each);
    const [adding, setAdding] = useDraft<readonly string[]>([], token.path);
    const page = tokenPage(state, token, adding);

    return (
        <article>
            <h1>{token.path}</h1>
            {page.deprecation.line && <DeprecatedLine line={page.deprecation.line} />}
            <Showing />
            {page.made && <MadeByLine made={page.made} />}
            {page.form && <ExtensionFields path={token.path} form={page.form} label={undefined} />}
            <dl>
                <DescriptionRow path={token.path} view={page.description} />
                {page.deprecation.box && (
                    <DeprecationRow path={token.path} box={page.deprecation.box} />
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
                                        key={`${problem.kind} ${problem.message} ${problem.inPermutations}`}
                                    >
                                        {problem.message}
                                        {problem.inPermutations && ` (${problem.inPermutations})`}
                                    </li>
                                ))}
                            </ul>
                        </dd>
                    </>
                )}
                <dt>CSS</dt>
                <dd>
                    {shown ? (
                        <AsCSS type={page.row.type} css={page.row.css} />
                    ) : (
                        <>Not in {state.showing.label}</>
                    )}
                </dd>
            </dl>
            {page.offers.map((label) => (
                <button key={label} type="button" onClick={() => setAdding([...adding, label])}>
                    Override for {label}
                </button>
            ))}
            {page.actions && <NodeActions path={token.path} />}
        </article>
    );
}

function MadeByLine({ made }: { made: MadeBy }) {
    switch (made.kind) {
        case "recipe":
            return (
                <p>
                    Made by the {made.by} on <NavLink to={hrefFor(made.from)}>{made.from}</NavLink>.
                </p>
            );
        case "group":
            return (
                <p>
                    Made by <NavLink to={hrefFor(made.from)}>{made.from}</NavLink>.
                </p>
            );
        case "top-level":
            return <p>Made by a recipe at the top of its file.</p>;
    }
}
