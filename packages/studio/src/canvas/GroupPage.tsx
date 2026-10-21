import { NavLink } from "react-router";
import { hrefFor } from "../app/token-path";
import type { Group } from "@sugarcube-sh/dtcg";
import { groupPage } from "../controllers/views";
import { useStudioState } from "../providers/studio-context";
import { ExtensionFields } from "./ExtensionFields";
import { NewToken } from "./NewToken";
import { Showing } from "./Showing";
import { AsCSS, Written } from "./Value";

export function GroupPage({ group, shown }: { group: Group; shown: boolean }) {
    const state = useStudioState((each) => each);
    const view = groupPage(state, group);

    return (
        <article>
            <h1>{view.path}</h1>
            {view.description && <p>{view.description}</p>}
            <Showing />
            {!shown && <p>Not in {state.showing.label}</p>}
            {view.form && <ExtensionFields form={view.form} label={undefined} />}

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
                                    <NavLink to={hrefFor(row.path)} end>
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
                                    <NavLink to={hrefFor(row.path)} end>
                                        {row.name}
                                    </NavLink>
                                </th>
                                <td>
                                    <Written value={row.written} />
                                </td>
                                <td>
                                    <AsCSS type={row.type} css={row.css} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <NewToken group={group} />
        </article>
    );
}

const noTokensText = {
    "at-all": "This group has no tokens.",
    "directly": "No tokens directly in this group.",
} as const;
