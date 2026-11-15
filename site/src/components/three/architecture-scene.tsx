import type { JSX } from "react";
import type { Graph } from "@/content/architecture";

/**
 * STUB. Another builder replaces this file with the real react-three-fiber scene.
 * The prop contract below is fixed: the 2D explorer lazy-loads this default export.
 */
export default function ArchitectureScene(props: {
  graph: Graph;
  visibleIds?: string[];
  highlightId?: string | null;
  explode?: number;
  onSelect?: (id: string) => void;
}): JSX.Element {
  const { graph, visibleIds, highlightId, onSelect } = props;
  const nodes = graph.nodes.filter((n) => !visibleIds || visibleIds.includes(n.id));
  return (
    <div
      role="group"
      aria-label={graph.title}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 16, alignContent: "flex-start", height: "100%" }}
    >
      {nodes.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => onSelect?.(n.id)}
          style={{
            minHeight: 44,
            padding: "0 12px",
            border: `1px solid ${highlightId === n.id ? "var(--ring)" : "var(--border)"}`,
            background: "var(--card)",
            color: "var(--foreground)",
          }}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}
