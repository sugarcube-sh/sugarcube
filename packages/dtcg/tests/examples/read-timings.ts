// Prints how long each stage of reading took, for a verbose mode or benchmarks.
import { read } from "@sugarcube-sh/dtcg/node";

await read("tokens/tokens.resolver.json", {
    onStage: (stage, ms) => row(stage, `${ms.toFixed(1)}ms`),
});
