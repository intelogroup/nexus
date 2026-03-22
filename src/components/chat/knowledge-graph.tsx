"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import cytoscape from 'cytoscape';
import { Loader2, Brain, RefreshCw, Network, CircleDot, LayoutGrid } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type LayoutType = 'cose' | 'concentric' | 'circle' | 'grid';

export function KnowledgeGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const layoutRef = useRef<cytoscape.Layouts | null>(null);
  const expandedRef = useRef<Set<string>>(new Set());
  const childrenMapRef = useRef<Map<string, string[]>>(new Map());

  const [elements, setElements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutType, setLayoutType] = useState<LayoutType>('cose');

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      expandedRef.current.clear();
      childrenMapRef.current.clear();
      const res = await fetch('/api/knowledge/graph');
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const data = await res.json();
      setElements(data.elements || []);
    } catch (err) {
      console.error("Fetch Graph Error:", err);
      setError(err instanceof Error ? err.message : 'Unknown fetch error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleBackfill = async () => {
    try {
      setSyncing(true);
      const res = await fetch('/api/knowledge/backfill', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync knowledge');
      await fetchGraph();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Robust Cytoscape Lifecycle
  useEffect(() => {
    let mounted = true;

    if (!containerRef.current || elements.length === 0) {
      if (cyRef.current) {
        if (layoutRef.current) {
          layoutRef.current.stop();
          layoutRef.current = null;
        }
        cyRef.current.destroy();
        cyRef.current = null;
      }
      return;
    }

    const domainCounts = elements
      .filter(e => e.data?.nodeType === 'domain')
      .map(e => e.data?.count ?? 0);
    const maxCount = Math.max(...domainCounts, 1);

    let cyInstance: cytoscape.Core | null = null;

    try {
      cyInstance = cytoscape({
        container: containerRef.current,
        elements: JSON.parse(JSON.stringify(elements)),
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: true,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#64748b',
              'width': '14px',
              'height': '14px',
              'label': 'data(label)',
              'font-size': '9px',
              'color': '#475569',
              'text-margin-y': 4,
              'text-valign': 'bottom',
              'overlay-opacity': 0,
              'text-wrap': 'ellipsis',
              'text-max-width': '60px',
            }
          },
          {
            selector: 'node[nodeType = "domain"]',
            style: {
              'background-color': '#7c3aed',
              'width': `mapData(count, 0, ${maxCount}, 30, 72)` as any,
              'height': `mapData(count, 0, ${maxCount}, 30, 72)` as any,
              'font-size': '11px',
              'font-weight': 700 as any,
              'color': '#1e1b4b',
              'text-max-width': '90px',
              'border-width': 2,
              'border-color': '#a78bfa',
              'border-opacity': 0.5,
            }
          },
          {
            selector: 'node[nodeType = "subdomain"]',
            style: {
              'background-color': '#0ea5e9',
              'width': '22px',
              'height': '22px',
              'font-size': '9px',
              'font-weight': 600 as any,
              'color': '#0c4a6e',
              'text-max-width': '70px',
            }
          },
          {
            selector: 'node.expanded',
            style: {
              'border-width': 3,
              'border-color': '#7c3aed',
              'border-opacity': 1,
            }
          },
          {
            selector: 'node.loading',
            style: {
              'border-width': 3,
              'border-color': '#a78bfa',
              'border-style': 'dashed',
              'opacity': 0.7,
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 1.5,
              'line-color': '#cbd5e1',
              'curve-style': 'bezier',
              'target-arrow-color': '#cbd5e1',
              'target-arrow-shape': 'triangle',
              'opacity': 0.4,
              'arrow-scale': 0.6,
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 3,
              'border-color': '#0ea5e9',
              'z-index': 999,
            }
          }
        ],
        layout: { name: 'null' }
      });

      if (!mounted) {
        cyInstance.destroy();
        return;
      }

      cyRef.current = cyInstance;

      // Expand / collapse on tap
      cyInstance.on('tap', 'node', async (e: any) => {
        const data = e.target.data();
        // Capture instance at tap-time
        const capturedCy = cyRef.current;

        const cyAlive = () =>
          !!capturedCy &&
          cyRef.current === capturedCy &&
          !(capturedCy as any).destroyed?.();

        if (!cyAlive()) return;

        try {
          // Collapse if already expanded
          if (expandedRef.current.has(data.id)) {
            const toRemove: string[] = [];
            const queue = [...(childrenMapRef.current.get(data.id) ?? [])];
            while (queue.length) {
              const id = queue.shift()!;
              toRemove.push(id);
              queue.push(...(childrenMapRef.current.get(id) ?? []));
              childrenMapRef.current.delete(id);
              expandedRef.current.delete(id);
            }
            capturedCy!.remove(capturedCy!.filter((el: any) => el.isNode() && toRemove.includes(el.id())));
            childrenMapRef.current.delete(data.id);
            expandedRef.current.delete(data.id);
            capturedCy!.getElementById(data.id).removeClass('expanded');
            return;
          }

          // Only domain and subdomain nodes expand
          if (data.nodeType !== 'domain' && data.nodeType !== 'subdomain') return;

          capturedCy!.getElementById(data.id).addClass('loading');

          let url = '';
          if (data.nodeType === 'domain') {
            url = `/api/knowledge/graph?domain_id=${data.id.replace('domain_', '')}`;
          } else {
            url = `/api/knowledge/graph?subdomain_id=${data.id}`;
          }

          const res = await fetch(url);
          const { elements: newElems } = await res.json();

          // Guard: instance may have been destroyed while fetch was in-flight
          if (!cyAlive()) return;
          if (!newElems || newElems.length === 0) return;

          const newNodes = newElems.filter((el: any) => !el.data.source);
          const newEdges = newElems.filter((el: any) => el.data.source);

          const parentNode = capturedCy!.getElementById(data.id);
          if (parentNode.length === 0) return;
          const parentPos = parentNode.position();
          const childRadius = data.nodeType === 'domain' ? 140 : 100;
          const childIds: string[] = [];

          newNodes.forEach((el: any, i: number) => {
            if (!cyAlive()) return;
            if (capturedCy!.getElementById(el.data.id).length > 0) return;
            const angle = (2 * Math.PI * i) / newNodes.length - Math.PI / 2;
            capturedCy!.add({
              group: 'nodes',
              data: el.data,
              position: {
                x: parentPos.x + childRadius * Math.cos(angle),
                y: parentPos.y + childRadius * Math.sin(angle),
              },
            });
            childIds.push(el.data.id);
            const edgeId = `e_${data.id}_${el.data.id}`;
            if (capturedCy!.getElementById(edgeId).length === 0) {
              capturedCy!.add({ group: 'edges', data: { id: edgeId, source: data.id, target: el.data.id } });
            }
          });

          newEdges.forEach((el: any) => {
            if (!cyAlive()) return;
            try {
              if (capturedCy!.getElementById(el.data.id).length === 0) {
                capturedCy!.add({ group: 'edges', data: el.data });
              }
            } catch (edgeErr) {
              console.error('[KG] edge add failed', { edgeId: el.data.id, error: edgeErr });
            }
          });

          if (!cyAlive()) return;
          expandedRef.current.add(data.id);
          childrenMapRef.current.set(data.id, childIds);
          capturedCy!.getElementById(data.id).addClass('expanded');

        } catch (tapErr) {
          console.error('[KG] tap handler error', {
            nodeId: data.id,
            nodeType: data.nodeType,
            error: tapErr instanceof Error ? tapErr.message : tapErr,
            stack: tapErr instanceof Error ? tapErr.stack : undefined,
          });
        } finally {
          if (cyAlive()) {
            capturedCy!.getElementById(data.id).removeClass('loading');
          }
        }
      });

      cyInstance.on('mouseover', 'node', (e: any) => {
        const nodeType = e.target.data('nodeType');
        if (containerRef.current) {
          containerRef.current.style.cursor = (nodeType === 'domain' || nodeType === 'subdomain') ? 'pointer' : 'default';
        }
      });
      cyInstance.on('mouseout', 'node', () => {
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      });

      // Run layout
      cyInstance.ready(() => {
        if (!mounted || !cyInstance || cyRef.current !== cyInstance) return;

        try {
          if (layoutRef.current) layoutRef.current.stop();

          const layout = cyInstance.layout({
            name: layoutType,
            animate: elements.length < 100,
            padding: 60,
            randomize: true,
            ...(layoutType === 'cose' && {
              componentSpacing: 100,
              nodeRepulsion: 25000,
              idealEdgeLength: 100,
            }),
            ...(layoutType === 'concentric' && {
              minNodeSpacing: 50,
              concentric: (node: any) => node.degree(),
              levelWidth: () => 1,
            })
          } as any);

          layoutRef.current = layout;

          layout.one('layoutstop', () => {
            if (mounted && cyRef.current === cyInstance && cyInstance) {
              const domainNodes = cyInstance.nodes('[nodeType = "domain"]');
              if (domainNodes.length > 0 && containerRef.current) {
                const w = containerRef.current.offsetWidth;
                const h = containerRef.current.offsetHeight;
                const radius = Math.min(w, h) * 0.36;
                const cx = w / 2;
                const cy = h / 2;
                domainNodes.forEach((node: any, i: number) => {
                  const angle = (2 * Math.PI * i) / domainNodes.length - Math.PI / 2;
                  node.position({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
                });
              }
              cyInstance.fit();
              layoutRef.current = null;
            }
          });

          layout.run();
        } catch (layoutErr) {
          console.error("Layout Run Error:", layoutErr);
        }
      });

    } catch (err) {
      console.error('[KG] Cytoscape init error', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
      });
    }

    return () => {
      mounted = false;
      if (layoutRef.current) {
        layoutRef.current.stop();
        layoutRef.current = null;
      }
      if (cyInstance) {
        cyInstance.stop();
        cyInstance.elements().stop();
        cyInstance.destroy();
        if (cyRef.current === cyInstance) cyRef.current = null;
      }
    };
  }, [elements, layoutType]);

  if (loading && elements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-primary" size={48} />
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest animate-pulse">Mapping Consciousness...</p>
      </div>
    );
  }

  const LayoutToggle = () => (
    <div className="flex items-center gap-1 bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl border border-slate-200/50 shadow-inner">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLayoutType('cose')}
        className={cn(
          "h-8 px-3 gap-2 rounded-lg text-[10px] font-bold transition-all",
          layoutType === 'cose' ? "bg-white shadow-sm text-primary" : "text-slate-500"
        )}
      >
        <Network size={14} />
        NEURAL
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLayoutType('concentric')}
        className={cn(
          "h-8 px-3 gap-2 rounded-lg text-[10px] font-bold transition-all",
          layoutType === 'concentric' ? "bg-white shadow-sm text-primary" : "text-slate-500"
        )}
      >
        <CircleDot size={14} />
        FOCUS
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLayoutType('grid')}
        className={cn(
          "h-8 px-3 gap-2 rounded-lg text-[10px] font-bold transition-all",
          layoutType === 'grid' ? "bg-white shadow-sm text-primary" : "text-slate-500"
        )}
      >
        <LayoutGrid size={14} />
        GRID
      </Button>
    </div>
  );

  return (
    <Card className="w-full h-full p-6 border-none shadow-none bg-transparent flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-start justify-between mb-8 shrink-0">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tighter uppercase italic flex items-center gap-3">
            <span className="text-primary">Brain</span>
            <span className="text-muted-foreground/20">Nexus</span>
          </h2>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.4em] opacity-50">
              Nodes: {elements.length}
            </p>
            <div className="h-px w-8 bg-slate-200" />
            <LayoutToggle />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={fetchGraph} disabled={loading || syncing} className="h-9 w-9 rounded-full border-slate-200">
            <RefreshCw className={cn("text-slate-500", loading && "animate-spin")} size={14} />
          </Button>
          <Button variant="default" size="sm" onClick={handleBackfill} disabled={loading || syncing} className="h-9 px-4 rounded-full gap-2 text-[11px] font-bold tracking-tight">
            {syncing ? <Loader2 className="animate-spin" size={14} /> : <Brain size={14} />}
            SYNC_ALL
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        <div className="flex-1 rounded-[2.5rem] bg-white border border-slate-100 shadow-2xl relative overflow-hidden flex flex-col group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#0ea5e905,transparent_40%)]" />
          {elements.length === 0 && !loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-20">
              <Brain size={64} className="mb-4" />
              <p className="text-sm font-mono uppercase tracking-widest italic">Awaiting Neural Data</p>
            </div>
          ) : (
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ flex: 1 }} />
          )}
        </div>
      </div>
    </Card>
  );
}
