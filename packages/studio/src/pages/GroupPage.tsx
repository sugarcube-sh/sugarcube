import { useMemo } from "react";
import { hrefFor } from "../app/token-path";
import { useCurrentContext, usePathIndex, useTokenStore } from "../store/hooks";
import { cssColorFor } from "../tokens/color-value";
import type { TokenNode } from "../tokens/groups";
import { type TokenRun, groupContent } from "../tokens/sections";
import { EditableDescription } from "./EditableDescription";
import { PageHeader } from "./PageHeader";
import { RecipeEditor } from "./RecipeEditor";
import { SwatchRun } from "./SwatchRun";
import { TokenRows } from "./TokenRows";
import { UsedBy } from "./UsedBy";

function isColourRun(run: TokenRun): boolean {
    return run.tokens.every((token) => token.$type === "color");
}

function RunSection({ run, group, note }: { run: TokenRun; group: TokenNode; note?: string }) {
    return (
        <section className="group-section flow">
            <h2 className="group-section-title">
                {run.name || group.title}
                {note && <span className="group-section-note text-quiet"> — {note}</span>}
            </h2>
            <TokenRows tokens={run.tokens} />
        </section>
    );
}

export function GroupPage({ group }: { group: TokenNode }) {
    const pathIndex = usePathIndex();
    const resolved = useTokenStore((state) => state.resolved);
    const context = useCurrentContext();

    const cssFor = useMemo(
        () => (path: string) => cssColorFor(path, (p) => pathIndex.readValue(resolved, p, context)),
        [pathIndex, resolved, context],
    );

    const { sets, roles } = useMemo(
        () =>
            groupContent(pathIndex.under(group.path), (path) =>
                pathIndex.readToken(resolved, path, context),
            ),
        [pathIndex, resolved, context, group.path],
    );

    const colourRuns = sets.filter(isColourRun);
    const otherRuns = sets.filter((run) => !isColourRun(run));

    const columns = colourRuns.reduce((widest, run) => Math.max(widest, run.tokens.length), 0);

    return (
        <>
            <PageHeader title={group.title} description={<EditableDescription path={group.path} />}>
                {group.count} {group.count === 1 ? "token" : "tokens"}
            </PageHeader>

            <RecipeEditor path={group.path} />

            {colourRuns.map((run) => (
                <SwatchRun
                    key={`swatches-${run.name}`}
                    run={run}
                    columns={columns}
                    cssFor={cssFor}
                    hrefFor={hrefFor}
                />
            ))}

            {otherRuns.map((run) => (
                <RunSection key={`set-${run.name}`} run={run} group={group} />
            ))}

            {roles.map((run) => (
                <RunSection key={`role-${run.name}`} run={run} group={group} note="roles" />
            ))}

            <UsedBy path={group.path} />
        </>
    );
}
