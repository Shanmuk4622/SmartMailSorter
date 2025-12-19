import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Zap, Server, Activity, Database } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'HUB' | 'LOCAL';
  status: 'active' | 'busy' | 'idle';
  label: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  value: number;
}

interface Particle {
  link: NetworkLink;
  t: number; // 0 to 1 (progress along link)
  speed: number;
}

// small helper
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const NetworkViz: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });
  const [metrics, setMetrics] = useState({ totalHubs: 0, activeRoutes: 0, uptime: '99.9%' });
  // Layout controls (user-tunable)
  // `dynamicLayout` when true means locals are free to move (dynamic); when false locals are pinned.
  const [dynamicLayout, setDynamicLayout] = useState<boolean>(true);
  const [chargeStrength, setChargeStrength] = useState<number>(-400);
  const [linkDistanceBase, setLinkDistanceBase] = useState<number>(200);
  const [hubPositionsOverride, setHubPositionsOverride] = useState<Record<string, { x: number; y: number }> | null>(null);
  const [hubLabelOverride, setHubLabelOverride] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Track current cleanup so rebuilds call previous cleanup first
    let currentCleanup: (() => void) | null = null;

    // Helper to (re)build the visualization when the container has non-zero size.
    const build = () => {
      const width = Math.max(300, containerRef.current!.clientWidth);
      const height = Math.max(200, containerRef.current!.clientHeight);

      // Clear previous
      d3.select(svgRef.current).selectAll("*").remove();

      const svg = d3.select(svgRef.current)
        .attr("viewBox", [0, 0, width, height])
        .attr("class", "w-full h-full")
        .attr('preserveAspectRatio', 'xMidYMid meet');

    // Define Filters & Gradients
    const defs = svg.append("defs");
    
    // Glow Filter
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Grid Pattern
    const pattern = defs.append("pattern")
      .attr("id", "grid")
      .attr("width", 40)
      .attr("height", 40)
      .attr("patternUnits", "userSpaceOnUse");
    pattern.append("path")
      .attr("d", "M 40 0 L 0 0 0 40")
      .attr("fill", "none")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 1);

    // Background Rect using Grid
    svg.append("rect")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "url(#grid)")
      .attr("opacity", 0.5);

    // Data
    const nodes: NetworkNode[] = [
      { id: "HUB-NYC", type: "HUB", status: "busy", label: "New York" },
      { id: "HUB-CHI", type: "HUB", status: "active", label: "Chicago" },
      { id: "HUB-LAX", type: "HUB", status: "active", label: "Los Angeles" },
      { id: "HUB-MIA", type: "HUB", status: "idle", label: "Miami" },
      
      { id: "LOC-BK", type: "LOCAL", status: "busy", label: "Brooklyn" },
      { id: "LOC-QN", type: "LOCAL", status: "active", label: "Queens" },
      { id: "LOC-NJ", type: "LOCAL", status: "active", label: "Jersey City" },
      
      { id: "LOC-NP", type: "LOCAL", status: "active", label: "Naperville" },
      { id: "LOC-EV", type: "LOCAL", status: "idle", label: "Evanston" },
      
      { id: "LOC-SM", type: "LOCAL", status: "active", label: "Santa Monica" },
      { id: "LOC-LB", type: "LOCAL", status: "active", label: "Long Beach" },
      { id: "LOC-PS", type: "LOCAL", status: "idle", label: "Pasadena" },
    ];

    // Apply label overrides from logs when available. We try direct id match first,
    // otherwise attempt a loose match by checking whether the override key appears
    // in the existing label or id (case-insensitive).
    if (hubLabelOverride) {
      nodes.forEach(n => {
        const direct = hubLabelOverride[n.id];
        if (direct) {
          n.label = direct;
          return;
        }
        // loose match: find an override whose key is substring of current label or id
        const found = Object.entries(hubLabelOverride).find(([k, v]) => {
          if (!k) return false;
          const kl = k.toLowerCase();
          const lab = (n.label || '').toLowerCase();
          const idl = (n.id || '').toLowerCase();
          return kl && (lab.includes(kl) || idl.includes(kl) || kl.includes(lab) || kl.includes(idl));
        });
        if (found) n.label = found[1];
      });
    }

    const links: NetworkLink[] = [
      { source: "HUB-NYC", target: "HUB-CHI", value: 5 },
      { source: "HUB-NYC", target: "HUB-LAX", value: 3 },
      { source: "HUB-NYC", target: "HUB-MIA", value: 2 },
      { source: "HUB-CHI", target: "HUB-LAX", value: 3 },
      { source: "HUB-NYC", target: "LOC-BK", value: 8 },
      { source: "HUB-NYC", target: "LOC-QN", value: 6 },
      { source: "HUB-NYC", target: "LOC-NJ", value: 5 },
      { source: "HUB-CHI", target: "LOC-NP", value: 4 },
      { source: "HUB-CHI", target: "LOC-EV", value: 3 },
      { source: "HUB-LAX", target: "LOC-SM", value: 5 },
      { source: "HUB-LAX", target: "LOC-LB", value: 6 },
      { source: "HUB-LAX", target: "LOC-PS", value: 2 },
    ];

    // === Positioning: assign meaningful geographic-like coordinates ===
    // Default hub positions (fractions of width/height). Can be overridden by logs.
    const defaultHubPositions: Record<string, { x: number; y: number }> = {
      'HUB-NYC': { x: 0.22, y: 0.30 },
      'HUB-CHI': { x: 0.48, y: 0.36 },
      'HUB-LAX': { x: 0.78, y: 0.42 },
      'HUB-MIA': { x: 0.66, y: 0.76 },
    };

    const hubPositions = hubPositionsOverride ?? defaultHubPositions;

    // Apply absolute coordinates for hubs and initial local placements near their hub
    nodes.forEach(n => {
      if (n.type === 'HUB') {
        const pos = hubPositions[n.id];
        if (pos) {
          n.x = width * pos.x;
          n.y = height * pos.y;
          // Fix hubs so they remain stable anchors
          n.fx = n.x;
          n.fy = n.y;
        }
      }
    });

    // Helper to find node by id
    const findNode = (id: string) => nodes.find(n => n.id === id) as NetworkNode | undefined;

    // For each link connecting a HUB to a LOCAL, place the local near the hub
    links.forEach(l => {
      const srcId = typeof l.source === 'string' ? l.source : (l.source as NetworkNode).id;
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as NetworkNode).id;

      // If one end is hub and the other is local, position local near hub
      const hubId = srcId.startsWith('HUB-') ? srcId : tgtId.startsWith('HUB-') ? tgtId : null;
      const locId = srcId.startsWith('LOC-') ? srcId : tgtId.startsWith('LOC-') ? tgtId : null;
      if (hubId && locId) {
        const hub = findNode(hubId);
        const local = findNode(locId);
          if (hub && local) {
          // place local at a small random offset around hub so they don't overlap exactly
          const angle = Math.random() * Math.PI * 2;
          const radius = 40 + Math.random() * 60;
          local.x = (hub.x ?? width / 2) + Math.cos(angle) * radius;
          local.y = (hub.y ?? height / 2) + Math.sin(angle) * radius;
            // pin or allow locals to be free based on control (dynamicLayout true => free)
            if (!dynamicLayout) {
              local.fx = local.x;
              local.fy = local.y;
            } else {
              local.fx = null;
              local.fy = null;
            }
        }
      }
    });

    // Initialize Particles
    const particles: Particle[] = [];
    links.forEach(link => {
      // Create 2-3 particles per link
      const count = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < count; i++) {
        particles.push({
          link,
          t: Math.random(), // Start at random position
          speed: 0.002 + Math.random() * 0.006 // Random speed
        });
      }
    });

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
        // d.target may be an id (string) during initialization — resolve to node if needed
        const targetNode: NetworkNode | undefined = typeof d.target === 'object'
          ? d.target as NetworkNode
          : nodes.find(n => n.id === d.target);
        // use configurable base distance; locals are closer
        return targetNode && targetNode.type === 'LOCAL' ? Math.max(40, linkDistanceBase * 0.4) : linkDistanceBase;
      }))
      .force("charge", d3.forceManyBody().strength(chargeStrength))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    // Links Layer (width indicates capacity/load)
    const linkGroup = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#334155")
      .attr("stroke-width", d => 1 + Math.sqrt(d.value))
      .attr("opacity", 0.45)
      .attr('stroke-linecap', 'round');

    // Particles Layer
    const particleGroup = svg.append("g").attr("class", "particles");
    const particleCircles = particleGroup.selectAll("circle")
      .data(particles)
      .enter().append("circle")
      .attr("r", 2.5)
      .attr("fill", "#60a5fa")
      .style("filter", "url(#glow)");

    // Nodes Layer
    const nodeGroup = svg.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g");

    // Create drag behavior and apply (cast to any to satisfy d3/TS selection typing)
    const dragBehavior = d3.drag<SVGGElement, NetworkNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);

    nodeGroup.call(dragBehavior as any);

    // Outer glow ring (Pulse animation)
    nodeGroup.append("circle")
      .attr("r", d => d.type === 'HUB' ? 30 : 15)
      .attr("fill", "transparent")
      .attr("stroke", d => {
        if (d.status === 'active') return "#10b981";
        if (d.status === 'busy') return "#f43f5e";
        return "#94a3b8";
      })
      .attr("stroke-width", 1)
      .attr("opacity", 0.3)
      .append("animate")
        .attr("attributeName", "r")
        .attr("from", d => d.type === 'HUB' ? 20 : 10)
        .attr("to", d => d.type === 'HUB' ? 35 : 18)
        .attr("dur", "2s")
        .attr("repeatCount", "indefinite");
      
    // Opacity pulse for the ring
    nodeGroup.selectAll("circle")
      .filter(":last-child") // select the ring we just appended
      .append("animate")
        .attr("attributeName", "opacity")
        .attr("values", "0.6;0;0.6")
        .attr("dur", "2s")
        .attr("repeatCount", "indefinite");

    // Main Node Body
    nodeGroup.append("circle")
      .attr("r", d => d.type === 'HUB' ? 15 : 6)
      .attr("fill", "#0f172a") // Dark slate background
      .attr("stroke", d => {
        if (d.status === 'active') return "#10b981"; // Emerald
        if (d.status === 'busy') return "#f43f5e"; // Rose
        return "#94a3b8"; // Slate
      })
      .attr("stroke-width", 2)
      .style("filter", "url(#glow)")
      .attr("class", "cursor-pointer transition-all hover:stroke-white")
      .on("click", (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      });

    // Inner Status Dot
    nodeGroup.append("circle")
      .attr("r", d => d.type === 'HUB' ? 4 : 2)
      .attr("fill", d => {
        if (d.status === 'active') return "#10b981";
        if (d.status === 'busy') return "#f43f5e";
        return "#94a3b8";
      });

    // Labels - show for all nodes, hubs emphasized
    nodeGroup.append("text")
      .text(d => d.type === 'HUB' ? d.label.toUpperCase() : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", d => d.type === 'HUB' ? -35 : -18)
      .attr("fill", d => d.type === 'HUB' ? "#e2e8f0" : "#94a3b8")
      .attr("font-size", d => d.type === 'HUB' ? "10px" : "9px")
      .attr("font-weight", d => d.type === 'HUB' ? "bold" : "600")
      .attr("letter-spacing", d => d.type === 'HUB' ? "1px" : "0.2px")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.6)");

    // Helper to safely resolve coordinates whether link endpoints are ids or node objects
    const resolveCoord = (end: string | NetworkNode, coord: 'x' | 'y') => {
      if (typeof end === 'object') return (end as NetworkNode)[coord] ?? 0;
      const found = nodes.find(n => n.id === end);
      return found ? (found as any)[coord] ?? 0 : 0;
    };

    simulation.on("tick", () => {
      // Update Lines (defensive: resolve both id and object cases)
      linkGroup
        .attr("x1", d => resolveCoord((d.source as any), 'x'))
        .attr("y1", d => resolveCoord((d.source as any), 'y'))
        .attr("x2", d => resolveCoord((d.target as any), 'x'))
        .attr("y2", d => resolveCoord((d.target as any), 'y'));

      // Update Nodes (guard against undefined coordinates)
      nodeGroup
        .attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);

      // Update Particles (use resolver for endpoints)
      particleCircles
        .attr("cx", d => {
          d.t += d.speed;
          if (d.t > 1) d.t = 0;
          const sx = resolveCoord((d.link.source as any), 'x');
          const tx = resolveCoord((d.link.target as any), 'x');
          return sx + (tx - sx) * d.t;
        })
        .attr("cy", d => {
          const sy = resolveCoord((d.link.source as any), 'y');
          const ty = resolveCoord((d.link.target as any), 'y');
          return sy + (ty - sy) * d.t;
        });
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }


    // Simulate changing load and update metrics periodically
    const metricInterval = setInterval(() => {
      // Randomly tweak link values and particle speeds to simulate traffic
      links.forEach(l => {
        const jitter = (Math.random() - 0.4) * 1.2;
        l.value = Math.max(1, Math.min(12, (l.value || 3) + jitter));
      });
      particleCircles.data().forEach((p: any) => {
        p.speed = 0.002 + Math.random() * 0.006 + (p.link.value || 0) * 0.0003;
      });
      // Update link stroke widths to reflect new values
      linkGroup.data(links).attr("stroke-width", d => 1 + Math.sqrt(d.value));

      // Update metrics state
      const totalHubs = nodes.filter(n => n.type === 'HUB').length;
      const activeRoutes = links.length;
      const uptime = (99.5 + Math.random() * 0.5).toFixed(2) + '%';
      setMetrics({ totalHubs, activeRoutes, uptime });
    }, 2000);

    return () => {
      clearInterval(metricInterval);
      simulation.stop();
    };
    };

    // Build now and keep its cleanup
    currentCleanup = build();

    // Watch for container size changes and rebuild visualization when necessary
    const ro = new ResizeObserver(() => {
      // Call previous cleanup then rebuild and keep new cleanup
      if (typeof currentCleanup === 'function') currentCleanup();
      currentCleanup = build();
    });
    ro.observe(containerRef.current);

    // Window resize fallback
    const onWin = () => {
      if (typeof currentCleanup === 'function') currentCleanup();
      currentCleanup = build();
    };
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWin);
      if (typeof currentCleanup === 'function') currentCleanup();
    };
  }, [dynamicLayout, chargeStrength, linkDistanceBase, hubPositionsOverride]);

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6">
      <div className="flex-1 bg-slate-950 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative group">
         {/* Top Gradient Line */}
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>
         
         <div className="absolute top-6 left-6 z-10 pointer-events-none">
           <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
             <Database className="w-6 h-6 text-cyan-400" />
             NETWORK TOPOLOGY
           </h2>
           <p className="text-slate-400 text-xs font-mono mt-1">LIVE TRAFFIC MONITORING /// NODE_STATUS_ACTIVE</p>
         </div>
         
         {/* Graph Container */}
         <div ref={containerRef} className="w-full h-[640px] cursor-move bg-gradient-to-b from-slate-900 via-slate-950 to-black">
           <svg ref={svgRef} className="w-full h-full"></svg>
         </div>

         {/* Legend */}
         <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-slate-700 flex flex-col gap-2">
           <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
             <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span> OPTIMAL
           </div>
           <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
             <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse"></span> HIGH LOAD
           </div>
           <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
             <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_#60a5fa]"></span> DATA PACKET
           </div>
         </div>
      </div>

      {/* Info Panel */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {/* Status Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Zap className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg backdrop-blur-sm border border-blue-500/20 text-blue-400">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">System Metrics</h3>
            </div>
            <div className="space-y-3">
              <MetricRow label="Total Hubs" value={`${metrics.totalHubs}`} />
              <MetricRow label="Active Routes" value={`${metrics.activeRoutes}`} />
              <MetricRow label="Uptime" value={`${metrics.uptime}`} />
            </div>
          </div>
        </div>

        {/* Layout Controls */}
        <div className="bg-slate-900/90 rounded-2xl p-4 text-white border border-slate-700">
          <h4 className="text-xs font-bold text-slate-300 mb-2">Layout Controls</h4>
          <div className="flex items-center justify-between mb-2 text-xs text-slate-300">
            <span>Dynamic Layout</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only" checked={dynamicLayout} onChange={(e) => setDynamicLayout(e.target.checked)} />
              <div className={`w-9 h-5 rounded-full transition-colors ${dynamicLayout ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
            </label>
          </div>
            <div className="flex gap-2 mb-2">
            <button onClick={async () => {
              // Fetch recent scan logs and create hub positions automatically
              // Prefer latitude/longitude when available and map to normalized coordinates
              try {
                const { data, error } = await supabase
                  .from('mail_scans')
                  .select('sorting_center_id, sorting_center_name, latitude, longitude')
                  .limit(1000);
                if (error) throw error;
                if (!data || data.length === 0) return;

                // collect rows that have lat/lon
                const rows = (data as any[]).map(r => ({
                  id: r.sorting_center_id || r.sorting_center_name,
                  name: r.sorting_center_name || r.sorting_center_id,
                  lat: r.latitude !== undefined && r.latitude !== null ? Number(r.latitude) : null,
                  lon: r.longitude !== undefined && r.longitude !== null ? Number(r.longitude) : null,
                }));

                // compute bounds for available coords
                const withCoords = rows.filter(r => r.lat !== null && r.lon !== null);
                const override: Record<string, { x: number; y: number }> = {};

                if (withCoords.length > 0) {
                  const lats = withCoords.map(r => r.lat as number);
                  const lons = withCoords.map(r => r.lon as number);
                  const minLat = Math.min(...lats);
                  const maxLat = Math.max(...lats);
                  const minLon = Math.min(...lons);
                  const maxLon = Math.max(...lons);

                  // normalize to 0..1 fractions (x => lon, y => lat inverted for screen coords)
                  const normX = (lon: number) => (lon - minLon) / (maxLon - minLon || 1);
                  const normY = (lat: number) => 1 - (lat - minLat) / (maxLat - minLat || 1);

                  // assign positions using the provided id/name as the override key
                  rows.forEach(r => {
                    if (r.lat === null || r.lon === null) return;
                    const xFrac = clamp(normX(r.lon as number), 0.05, 0.95);
                    const yFrac = clamp(normY(r.lat as number), 0.05, 0.95);
                    override[String(r.id)] = { x: xFrac, y: yFrac };
                  });

                } else {
                  // fallback: no coords available, place hubs evenly around a circle
                  const ids = Array.from(new Set(rows.map(r => r.id)));
                  const centerX = 0.5; const centerY = 0.45; const radiusFrac = 0.30;
                  ids.forEach((id, i) => {
                    const angle = (i / ids.length) * Math.PI * 2;
                    override[id.toString()] = {
                      x: centerX + Math.cos(angle) * radiusFrac,
                      y: centerY + Math.sin(angle) * radiusFrac
                    };
                  });
                }

                setHubPositionsOverride(override);
                // also keep a mapping of id->label from logs so we can rename nodes
                const labelMap: Record<string, string> = {};
                rows.forEach(r => {
                  if (r.name) labelMap[String(r.id)] = r.name;
                });
                setHubLabelOverride(labelMap);
                // set dynamic layout to true so nodes can settle around hubs
                setDynamicLayout(true);
              } catch (err) {
                // ignore errors silently for now
                console.error('Load logs failed', err);
              }
            }} className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs">Load From Logs</button>
            <button onClick={() => setHubPositionsOverride(null)} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs">Reset Hubs</button>
          </div>
          <div className="text-xs text-slate-300 mb-2">Repel Strength: {chargeStrength}</div>
          <input type="range" min={-1200} max={-50} value={chargeStrength} onChange={(e) => setChargeStrength(Number(e.target.value))} className="w-full mb-3" />
          <div className="text-xs text-slate-300 mb-2">Link Distance: {linkDistanceBase}px</div>
          <input type="range" min={60} max={400} value={linkDistanceBase} onChange={(e) => setLinkDistanceBase(Number(e.target.value))} className="w-full" />
        </div>

        {/* Node Details */}
        <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Server className="w-5 h-5 text-slate-400" />
            Node Inspector
          </h3>
          
          {selectedNode ? (
            <div className="animate-fade-in space-y-6">
              <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white shadow-lg">
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  selectedNode.status === 'active' ? 'bg-emerald-500' :
                  selectedNode.status === 'busy' ? 'bg-rose-500' : 'bg-slate-500'
                }`}></div>
                
                  <p className="text-xs font-mono text-slate-400 mb-2">{selectedNode.type}_ID: {selectedNode.id}</p>
                <h2 className="text-2xl font-bold mb-1">{selectedNode.label}</h2>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                     selectedNode.status === 'active' ? 'bg-emerald-500' :
                     selectedNode.status === 'busy' ? 'bg-rose-500' : 'bg-slate-500'
                  }`}></div>
                  <span className="text-sm font-medium uppercase tracking-wider">{selectedNode.status}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Queue</p>
                    <p className="text-xl font-mono font-bold text-slate-800">{Math.floor(Math.random() * 300)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-bold uppercase mb-1">Latency</p>
                    <p className="text-xl font-mono font-bold text-slate-800">{Math.floor(Math.random() * 80) + 5}ms</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Queue</p>
                  <p className="text-xl font-mono font-bold text-slate-800">{Math.floor(Math.random() * 500)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-bold uppercase mb-1">Latency</p>
                  <p className="text-xl font-mono font-bold text-slate-800">{Math.floor(Math.random() * 20) + 5}ms</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                 <RefreshCw className="w-6 h-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">Select any node on the topology graph to view real-time diagnostics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-white/5">
    <span className="text-sm font-medium text-slate-400">{label}</span>
    <span className="font-bold font-mono text-white">{value}</span>
  </div>
);

export default NetworkViz;