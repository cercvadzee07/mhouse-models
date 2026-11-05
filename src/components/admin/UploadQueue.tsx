"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCancelled } from "@/lib/admin/upload-client";
import { Button } from "./ui";

export type QueueItem = {
  key: string;
  name: string;
  size: number;
  progress: number;
  stage: string;
  status: "queued" | "uploading" | "processing" | "done" | "error" | "cancelled";
  error?: string;
};

type Task = (helpers: { setProgress: (p: number) => void; setStage: (s: string) => void; signal: AbortSignal }) => Promise<void>;

/**
 * A small upload queue: runs tasks with limited concurrency, tracks progress
 * and stage per file, and supports cancellation.
 */
export function useUploadQueue(concurrency = 2) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const pending = useRef<{ key: string; task: Task }[]>([]);
  const running = useRef(0);

  const patch = useCallback((key: string, p: Partial<QueueItem>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }, []);

  const pump = useCallback(() => {
    while (running.current < concurrency && pending.current.length) {
      const next = pending.current.shift()!;
      const controller = new AbortController();
      controllers.current.set(next.key, controller);
      running.current++;
      patch(next.key, { status: "uploading" });
      next
        .task({
          setProgress: (p) => patch(next.key, { progress: p }),
          setStage: (s) => patch(next.key, { stage: s, status: s === "Processing…" || s.startsWith("Converting") || s.startsWith("Optimizing") ? "processing" : "uploading" }),
          signal: controller.signal,
        })
        .then(() => patch(next.key, { status: "done", progress: 1, stage: "Done" }))
        .catch((e) =>
          patch(next.key, e instanceof UploadCancelled ? { status: "cancelled", stage: "Cancelled" } : { status: "error", error: e instanceof Error ? e.message : String(e), stage: "Failed" }),
        )
        .finally(() => {
          running.current--;
          controllers.current.delete(next.key);
          pump();
        });
    }
  }, [concurrency, patch]);

  const add = useCallback(
    (file: { name: string; size: number }, task: Task) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setItems((list) => [...list, { key, name: file.name, size: file.size, progress: 0, stage: "Queued", status: "queued" }]);
      pending.current.push({ key, task });
      pump();
      return key;
    },
    [pump],
  );

  const reject = useCallback((file: { name: string; size: number }, error: string) => {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((list) => [...list, { key, name: file.name, size: file.size, progress: 0, stage: "Rejected", status: "error", error }]);
  }, []);

  const cancel = useCallback(
    (key: string) => {
      const c = controllers.current.get(key);
      if (c) c.abort();
      else {
        pending.current = pending.current.filter((p) => p.key !== key);
        patch(key, { status: "cancelled", stage: "Cancelled" });
      }
    },
    [patch],
  );

  const clearFinished = useCallback(() => setItems((list) => list.filter((i) => !["done", "cancelled", "error"].includes(i.status))), []);

  return { items, add, reject, cancel, clearFinished };
}

export function UploadQueueView({ queue }: { queue: ReturnType<typeof useUploadQueue> }) {
  if (!queue.items.length) return null;
  const finished = queue.items.some((i) => ["done", "cancelled", "error"].includes(i.status));
  return (
    <div className="mt-3 space-y-2">
      {queue.items.map((i) => (
        <div key={i.key} className="rounded-lg border border-black/[0.08] bg-[#fbfaf8] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3 text-[0.8rem]">
            <span className="truncate font-medium">{i.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={i.status === "error" ? "text-[#a4442e]" : i.status === "done" ? "text-[#3d5638]" : "text-black/55"}>
                {i.status === "uploading" ? `${Math.round(i.progress * 100)}%` : i.stage}
              </span>
              {["queued", "uploading"].includes(i.status) && (
                <button type="button" onClick={() => queue.cancel(i.key)} className="text-black/45 hover:text-[#a4442e]" aria-label={`Cancel ${i.name}`}>
                  ✕
                </button>
              )}
            </span>
          </div>
          {["uploading", "processing", "queued"].includes(i.status) && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.07]">
              <div
                className={`h-full rounded-full bg-[#161614] transition-[width] duration-300 ${i.status === "processing" ? "animate-pulse" : ""}`}
                style={{ width: `${i.status === "processing" ? 100 : Math.max(2, i.progress * 100)}%` }}
              />
            </div>
          )}
          {i.error && <p className="mt-1.5 text-[0.75rem] leading-snug text-[#a4442e]">{i.error}</p>}
        </div>
      ))}
      {finished && (
        <Button size="sm" variant="ghost" onClick={queue.clearFinished}>
          Clear finished
        </Button>
      )}
    </div>
  );
}
