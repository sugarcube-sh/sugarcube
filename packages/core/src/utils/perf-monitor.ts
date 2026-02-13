const PERF = process.env.SUGARCUBE_PERF === "true";

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
