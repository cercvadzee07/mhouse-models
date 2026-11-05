"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { ModelViewerLabels } from "@/components/three/ModelViewer";

const ModelViewer = dynamic(() => import("@/components/three/ModelViewer"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-stone" />,
});

export function ProjectModels({
  models,
  labels,
}: {
  models: { id: string; url: string; label: string }[];
  labels: ModelViewerLabels;
}) {
  const [active, setActive] = useState(0);
  const current = models[active];
  if (!current) return null;
  return (
    <div>
      {models.length > 1 && (
        <div role="tablist" className="mb-4 flex flex-wrap gap-2">
          {models.map((m, i) => (
            <button
              key={m.id}
              role="tab"
              type="button"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${i === active ? "border-ink bg-ink text-paper" : "hairline hover:border-ink"}`}
            >
              {m.label || `3D ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <ModelViewer key={current.id} url={current.url} labels={labels} className="h-[62svh] min-h-[360px] w-full md:h-[78svh]" />
    </div>
  );
}
