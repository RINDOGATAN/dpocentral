"use client";

import dynamic from "next/dynamic";

// Client-only: React Flow reads window/devicePixelRatio on mount, which
// causes hydration mismatches if server-rendered.
const PreviewCanvas = dynamic(
  () => import("./PreviewCanvas").then((m) => m.PreviewCanvas),
  { ssr: false, loading: () => <div className="p-8 text-sm text-muted-foreground">Loading preview…</div> }
);

export default function FlowMapPreviewPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      <header
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>
            Data Flow Map — Preview
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
            Unauthenticated mock preview of the redesigned flow visualization.
            Hover a node to focus its 1-hop neighbourhood. Use the sensitivity
            pills and the category filter to slice the graph.
          </p>
        </div>
        <div
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: "#94a3b8" }}
        >
          Mock data · dev only
        </div>
      </header>
      <PreviewCanvas />
    </div>
  );
}
