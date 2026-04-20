const DEBUG = process.env.DEBUG === "true";
const PERF = process.env.SUGARCUBE_PERF === "true";

// ============================================
// DefaultMap — Map that auto-creates entries via a factory
// ============================================

export class DefaultMap<T = string, V = any> extends Map<T, V> {
    constructor(private factory: (key: T, self: DefaultMap<T, V>) => V) {
        super();
    }

    get(key: T): V {
        let value = super.get(key);

        if (value === undefined) {
            value = this.factory(key, this);
            this.set(key, value);
        }

        return value;
    }
}

// ============================================
// Instrumentation — call counts and execution times (Tailwind-inspired)
// ============================================

/**
 * Instrumentation for tracking function call counts and execution times.
 * Only active when DEBUG=true environment variable is set.
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

// ============================================
// PerfMonitor — memory and watcher event tracking
// ============================================

/**
 * Performance monitor for tracking memory usage and watcher events.
 * Only active when SUGARCUBE_PERF=true environment variable is set.
 */
export class PerfMonitor implements Disposable {
    #lastMemSnapshot = 0;
    #watcherEventCount = 0;
    #lastWatcherReset = Date.now();
    #memoryMonitorInterval: NodeJS.Timeout | null = null;
    #lastReportedMem = 0;

    constructor(
        private defaultFlush = (message: string) => void process.stderr.write(`${message}\n`)
    ) {}

    #getMemMB(): number {
        return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    }

    #formatTimestamp(): string {
        return new Date().toISOString().split("T")[1]?.slice(0, -1) ?? "";
    }

    log(message: string, data?: Record<string, unknown>): void {
        if (!PERF) return;
        const timestamp = this.#formatTimestamp();
        const mem = this.#getMemMB();
        const memDelta = mem - this.#lastMemSnapshot;
        this.#lastMemSnapshot = mem;
        this.defaultFlush(
            `[perf ${timestamp}] ${message} ${data ? JSON.stringify(data) : ""} | heap: ${mem}MB (${memDelta >= 0 ? "+" : ""}${memDelta}MB)`
        );
    }

    trackWatcherEvent(file: string, moduleGraphSize: number): void {
        if (!PERF) return;

        this.#watcherEventCount++;
        const now = Date.now();

        const shortFile = file.split("/").slice(-3).join("/");
        this.log(`WATCHER EVENT #${this.#watcherEventCount}: ${shortFile}`);

        if (now - this.#lastWatcherReset > 10000) {
            this.log("WATCHER STATS (last 10s)", {
                events: this.#watcherEventCount,
                moduleGraphSize,
            });
            this.#watcherEventCount = 0;
            this.#lastWatcherReset = now;
        }
    }

    logWatcherSetup(pattern: string, dir: string): void {
        if (!PERF) return;
        this.log("WATCHER SETUP: Adding watch pattern", { pattern, dir });
    }

    logModuleGraphStats(modules: number, urls: number, context: string): void {
        if (!PERF) return;
        this.log(`MODULE GRAPH (${context})`, { modules, urls });
    }

    startMemoryMonitor(): void {
        if (!PERF || this.#memoryMonitorInterval) return;

        this.log("PERF MONITORING ENABLED - Starting memory monitor");
        this.#lastReportedMem = this.#getMemMB();

        this.#memoryMonitorInterval = setInterval(() => {
            const currentMem = this.#getMemMB();
            const delta = currentMem - this.#lastReportedMem;
            if (Math.abs(delta) > 5) {
                this.log("MEMORY CHANGE", {
                    from: this.#lastReportedMem,
                    to: currentMem,
                    delta,
                });
                this.#lastReportedMem = currentMem;
            }
        }, 5000);
    }

    stopMemoryMonitor(): void {
        if (this.#memoryMonitorInterval) {
            clearInterval(this.#memoryMonitorInterval);
            this.#memoryMonitorInterval = null;
        }
    }

    [Symbol.dispose](): void {
        this.stopMemoryMonitor();
    }
}
