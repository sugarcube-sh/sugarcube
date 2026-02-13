import { DefaultMap } from "./default-map";

const DEBUG = process.env.DEBUG === "true";

/**
 * Instrumentation for tracking function call counts and execution times.
 * Only active when DEBUG=true environment variable is set.
 * Inspired by Tailwind CSS instrumentation.
 */
export class Instrumentation implements Disposable {
    #hits = new DefaultMap(() => ({ value: 0 }));
    #timers = new DefaultMap(() => ({ value: 0n }));
    #timerStack: { id: string; label: string; namespace: string; value: bigint }[] = [];

    constructor(
        private defaultFlush = (message: string) => void process.stderr.write(`${message}\n`)
    ) {}

    hit(label: string) {
        this.#hits.get(label).value++;
    }

    start(label: string) {
        const namespace = this.#timerStack.map((t) => t.label).join("//");
        const id = `${namespace}${namespace.length === 0 ? "" : "//"}${label}`;
        this.#hits.get(id).value++;
        this.#timers.get(id);
        this.#timerStack.push({ id, label, namespace, value: process.hrtime.bigint() });
    }

    end(label: string) {
        const end = process.hrtime.bigint();
        if (this.#timerStack.length === 0) {
            throw new Error("Timer stack is empty");
        }
        const lastIndex = this.#timerStack.length - 1;
        const lastTimer = this.#timerStack[lastIndex];
        if (!lastTimer) {
            throw new Error("Timer stack is corrupted");
        }
        if (lastTimer.label !== label) {
            throw new Error(`Mismatched timer label: ${label}`);
        }
        const parent = this.#timerStack.pop();
        if (!parent) throw new Error("Timer stack is empty");
        const elapsed = end - parent.value;
        this.#timers.get(parent.id).value += elapsed;
    }

    report(flush = this.defaultFlush) {
        const output: string[] = [];
        let hasHits = false;

        // Auto end any pending timers
        for (let i = this.#timerStack.length - 1; i >= 0; i--) {
            const timer = this.#timerStack[i];
            if (!timer) continue;
            this.end(timer.label);
        }

        for (const [label, { value: count }] of this.#hits.entries()) {
            if (this.#timers.has(label)) continue;
            if (output.length === 0) {
                hasHits = true;
                output.push("Hits:");
            }
            const depth = label.split("//").length;
            output.push(`${"  ".repeat(depth)}${label} × ${count}`);
        }

        if (this.#timers.size > 0) {
            if (hasHits) output.push("\nTimers:");
            for (const [label, { value }] of this.#timers) {
                const depth = label.split("//").length;
                const time = `${(Number(value) / 1e6).toFixed(2)}ms`;
                output.push(
                    `${"  ".repeat(depth - 1)}${label.split("//").pop()} [${time}] ${
                        this.#hits.get(label).value === 1 ? "" : `× ${this.#hits.get(label).value}`
                    }`.trimEnd()
                );
            }
        }

        flush(`\n${output.join("\n")}\n`);
    }

    [Symbol.dispose]() {
        if (DEBUG) {
            this.report();
        }
    }
}
