// Replays edits saved in a link onto files that may have changed since. An edit that no longer fits
// is reported, not forced.
import { decodeEdits, apply, type Project } from "@sugarcube-sh/dtcg-edit";

declare let project: Project;

const saved = await decodeEdits(fromUrl);
const result = apply(project, saved.ops);
if ("conflicts" in result) showConflicts(result.conflicts);
else project = result;
