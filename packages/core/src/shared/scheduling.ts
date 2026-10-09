export type ChangeQueue<Change extends { kind: string }> = ((change: Change) => void) & {
    cancel: () => void;
};

export interface ChangeQueueCallbacks<Change> {
    onChange: (change: Change) => Promise<void>;
    onError: (error: unknown) => void;
}

export function createChangeQueue<Change extends { kind: string }>(
    order: readonly Change["kind"][],
    { onChange, onError }: ChangeQueueCallbacks<Change>,
): ChangeQueue<Change> {
    const waiting = new Map<Change["kind"], Change>();
    let running = false;

    const next = () => order.map((kind) => waiting.get(kind)).find(Boolean);

    const drain = async () => {
        running = true;
        for (let change = next(); change; change = next()) {
            waiting.delete(change.kind);
            try {
                await onChange(change);
            } catch (error) {
                onError(error);
            }
        }
        running = false;
    };

    const queue = (change: Change) => {
        waiting.set(change.kind, change);
        if (!running) void drain();
    };
    queue.cancel = () => waiting.clear();
    return queue;
}
