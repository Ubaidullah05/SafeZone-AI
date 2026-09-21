const QUEUE_KEY = "safezone_sos_queue";

export interface QueuedSOS {
    id: string;
    queued_at: string;
    transport: string;
    status: string;
    [key: string]: unknown;
}

export function getSOSQueue(): QueuedSOS[] {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch {
        return [];
    }
}

export function queueSOS(sos: Record<string, unknown>): QueuedSOS {
    const queue = getSOSQueue();
    const id = (sos.id as string) || `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const item: QueuedSOS = {
        ...sos,
        id,
        queued_at: (sos.queued_at as string) || new Date().toISOString(),
        transport: (sos.transport as string) || "OFFLINE",
        status: "QUEUED",
    };

    const existingIdx = queue.findIndex(q => q.id === id);
    if (existingIdx >= 0) {
        queue[existingIdx] = item;
    } else {
        queue.push(item);
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return item;
}

export function removeSOS(id: string): void {
    const queue = getSOSQueue().filter(item => item.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearSOSQueue(): void {
    localStorage.removeItem(QUEUE_KEY);
}

export async function syncSOSQueue(
    submitFn: (item: QueuedSOS) => Promise<unknown>
): Promise<{ synced: number; failed: number }> {
    const queue = getSOSQueue();
    if (queue.length === 0) {
        return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const item of queue) {
        try {
            await submitFn(item);
            if (item.id) {
                removeSOS(item.id);
            }
            synced++;
        } catch (err) {
            failed++;
            console.warn("Failed to sync queued SOS item:", item.id, err);
        }
    }

    if (synced > 0 && typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("safezone:sos-synced", {
                detail: { synced, remaining: getSOSQueue().length },
            })
        );
    }

    return { synced, failed };
}

export function initOfflineSync(
    syncFn: () => Promise<{ synced: number; failed: number }>
): () => void {
    if (typeof window === "undefined") return () => {};

    let isSyncing = false;

    const triggerSync = async () => {
        if (isSyncing || !navigator.onLine) return;
        const queue = getSOSQueue();
        if (queue.length === 0) return;

        isSyncing = true;
        try {
            await syncFn();
        } catch (e) {
            console.error("Auto-sync error:", e);
        } finally {
            isSyncing = false;
        }
    };

    const handleOnline = () => {
        void triggerSync();
    };

    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
        void triggerSync();
    }

    return () => {
        window.removeEventListener("online", handleOnline);
    };
}
