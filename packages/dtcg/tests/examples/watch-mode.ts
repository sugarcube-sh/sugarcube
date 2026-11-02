// Watch mode. It watches every file the tokens were read from, the resolver included, and reads
// again when one changes. A file newly added to the resolver is watched from then on.
import { type FileWatcher, createLiveTokens } from "@sugarcube-sh/dtcg/node";

declare const watcher: FileWatcher;

const live = createLiveTokens(
    { entry: "tokens/tokens.resolver.json" },
    { onError: (error) => showMessage(String(error)) },
);
live.watch(watcher);
live.onRead((tokens, { file }) =>
    showMessage(`${file} saved: ${tokens.diagnostics.length} problems`),
);
