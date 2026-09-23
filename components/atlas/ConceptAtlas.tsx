"use client";

import { useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ConceptNode, type ConceptNodeData } from "./ConceptNode";
import { ConceptPanel } from "./ConceptPanel";
import { useSessionStore } from "@/lib/session-store";
import { DB2_CONCEPTS, CATEGORY_LABELS } from "@/lib/db2-concepts";
import { cn } from "@/lib/cn";

const nodeTypes: NodeTypes = { concept: ConceptNode };

const EDGE_COLORS: Record<string, string> = {
  "feeds-into":   "#1e3a5f",
  "depends-on":   "#2d1b5e",
  "monitors":     "#0a2030",
  "controls":     "#3d1a00",
  "impacts":      "#1a3d1a",
  "component-of": "#1a1a3d",
  "triggers":     "#3d1a1a",
  "configures":   "#203030",
};

function buildGraph(
  filterCategory: string | null,
  progress: Record<string, { familiarity: number }>
): { nodes: Node[]; edges: Edge[] } {
  const visibleConcepts = filterCategory
    ? DB2_CONCEPTS.filter(c => c.category === filterCategory)
    : DB2_CONCEPTS;
  const visibleIds = new Set(visibleConcepts.map(c => c.id));

  const nodes: Node[] = visibleConcepts.map(concept => ({
    id: concept.id,
    type: "concept",
    position: concept.position,
    data: {
      concept,
      isSelected: false,
      familiarity: progress[concept.id]?.familiarity ?? 0,
    } satisfies ConceptNodeData,
  }));

  const edges: Edge[] = [];
  visibleConcepts.forEach(concept => {
    concept.connections.forEach(conn => {
      if (!visibleIds.has(conn.targetId)) return;
      edges.push({
        id: `${concept.id}-${conn.targetId}-${conn.type}`,
        source: concept.id,
        target: conn.targetId,
        label: conn.label,
        style: {
          stroke: EDGE_COLORS[conn.type] ?? "var(--color-border-default)",
          strokeWidth: 1.5,
        },
        labelStyle: { fontSize: 9, fill: "var(--color-text-muted)" },
        labelBgStyle: { fill: "var(--color-surface-panel)", fillOpacity: 0.9 },
        labelBgPadding: [3, 6] as [number, number],
        animated: false,
      });
    });
  });

  return { nodes, edges };
}

export function ConceptAtlas() {
  const { progress, setLastConceptId } = useSessionStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(filterCategory, progress),
    [filterCategory, progress]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Rebuild when filter changes
  useMemo(() => {
    const { nodes: n, edges: e } = buildGraph(filterCategory, progress);
    setNodes(n.map(node => ({
      ...node,
      data: {
        ...(node.data as unknown as ConceptNodeData),
        isSelected: node.id === selectedId,
      },
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, selectedId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id);
    setLastConceptId(node.id);
    setNodes(ns => ns.map(n => ({
      ...n,
      data: { ...(n.data as unknown as ConceptNodeData), isSelected: n.id === node.id },
    })));
  }, [setNodes, setLastConceptId]);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
    setNodes(ns => ns.map(n => ({
      ...n,
      data: { ...(n.data as unknown as ConceptNodeData), isSelected: false },
    })));
  }, [setNodes]);

  const selectedConcept = selectedId
    ? DB2_CONCEPTS.find(c => c.id === selectedId) ?? null
    : null;

  const navigateTo = useCallback((id: string) => {
    setSelectedId(id);
    setLastConceptId(id);
    setNodes(ns => ns.map(n => ({
      ...n,
      data: { ...(n.data as unknown as ConceptNodeData), isSelected: n.id === id },
    })));
  }, [setNodes, setLastConceptId]);

  const categories = [...new Set(DB2_CONCEPTS.map(c => c.category))];

  return (
    <div className="flex h-full">
      {/* Canvas */}
      <div className="flex-1 relative">
        {/* Category filter bar */}
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCategory(null)}
            className={cn(
              "px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border",
              filterCategory === null
                ? "bg-blue-900 border-blue-700 text-blue-200"
                : "bg-[var(--color-surface-elevated)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            )}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider border",
                filterCategory === cat
                  ? "bg-blue-900 border-blue-700 text-blue-200"
                  : "bg-[var(--color-surface-elevated)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{ type: "smoothstep" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="var(--color-border-default)"
          />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as unknown as ConceptNodeData;
              const cat = d.concept?.category ?? "admin";
              const colors: Record<string, string> = {
                architecture: "#1e4080", memory: "#0d6080", logging: "#604020",
                hadr: "#3d1a80", performance: "#0d5020", monitoring: "#203060",
                locking: "#801818", admin: "#302050",
              };
              return colors[cat] ?? "var(--color-border-strong)";
            }}
            maskColor="rgba(8,12,21,0.7)"
          />
        </ReactFlow>
      </div>

      {/* Detail panel */}
      {selectedConcept && (
        <ConceptPanel
          concept={selectedConcept}
          onClose={() => {
            setSelectedId(null);
            setNodes(ns => ns.map(n => ({
              ...n,
              data: { ...(n.data as unknown as ConceptNodeData), isSelected: false },
            })));
          }}
          onNavigateTo={navigateTo}
        />
      )}
    </div>
  );
}
