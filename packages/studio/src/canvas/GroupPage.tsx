import { Fragment } from "react";
import { NavLink } from "react-router";
import { toHref } from "../app/token-path";
import type { Group } from "@sugarcube-sh/dtcg";
import { getGroupPageView } from "../controllers/views";
import { useStudioState } from "../providers/studio-context";
import { ExtensionFields } from "./ExtensionFields";
import { DeprecatedLine, DeprecationRow, DescriptionRow } from "./Properties";
import { NewGroup } from "./NewGroup";
import { NewToken } from "./NewToken";
import { NodeActions } from "./NodeActions";
import { PermutationSelect } from "./PermutationSelect";
import { CSSValue, ValueText } from "./Value";

export function GroupPage({ group, isShown }: { group: Group; isShown: boolean }) {
    const state = useStudioState((each) => each);
    const view = getGroupPageView(state, group);

    return (
        <article>
            <h1>{view.path}</h1>
            {view.deprecation.notice && <DeprecatedLine line={view.deprecation.notice} />}
            <PermutationSelect />
            {!isShown && <p>Not in {state.shownPermutation.label}</p>}
            <dl>
                <DescriptionRow path={group.path} view={view.description} />
                {view.deprecation.checkbox && (
                    <DeprecationRow path={group.path} box={view.deprecation.checkbox} />
                )}
            </dl>
            {view.form && (
                <ExtensionFields path={group.path} form={view.form} rowName={undefined} />
            )}

            {view.groups.length > 0 && (
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Group</th>
                            <th scope="col">Tokens</th>
                        </tr>
                    </thead>
                    <tbody>
                        {view.groups.map((row) => (
                            <tr key={row.path}>
                                <th scope="row">
                                    <NavLink to={toHref(row.path)} end>
                                        {row.name}
                                    </NavLink>
                                </th>
                                <td>{row.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {view.noTokens ? (
                <p>{noTokensText[view.noTokens]}</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th scope="col">Token</th>
                            <th scope="col">Value</th>
                            <th scope="col">CSS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {view.tokens.map((row) => (
                            <tr key={row.path}>
                                <th scope="row">
                                    <NavLink to={toHref(row.path)} end>
                                        {row.name}
                                    </NavLink>
                                </th>
                                <td>
                                    <ValueText value={row.originalValue} />
                                </td>
                                <td>
                                    <CSSValue type={row.type} css={row.css} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {view.editable && (
                <Fragment key={group.path}>
                    <NewToken group={group} />
                    <NewGroup parent={group.path} />
                    <NodeActions path={group.path} />
                </Fragment>
            )}
        </article>
    );
}

const noTokensText = {
    "at-all": "This group has no tokens.",
    "directly": "No tokens directly in this group.",
} as const;
