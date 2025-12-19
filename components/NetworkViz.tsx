import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Zap, Server, Activity, Database } from 'lucide-react';

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

const NetworkViz: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("class", "w-full h-full");

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

    // Initialize Particles
    const particles: Particle[] = [];
    links.forEach(link => {
      // Create 2-3 particles per link
      const count = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < count; i++) {
        particles.push({
          link,
          t: Math.random(), // Start at random position
          speed: 0.002 + Math.random() * 0.004 // Random speed
        });
      }
    });

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
        // d.target may be an id (string) during initialization — resolve to node if needed
        const targetNode: NetworkNode | undefined = typeof d.target === 'object'
          ? d.target as NetworkNode
          : nodes.find(n => n.id === d.target);
        return targetNode && targetNode.type === 'LOCAL' ? 80 : 200;
      }))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    // Links Layer
    const linkGroup = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#334155")
      .attr("stroke-width", d => Math.sqrt(d.value))
      .attr("opacity", 0.4);

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
      .join("g")
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

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

    // Labels
    nodeGroup.append("text")
      .text(d => d.type === 'HUB' ? d.label.toUpperCase() : '')
      .attr("text-anchor", "middle")
      .attr("dy", -35)
      .attr("fill", "#e2e8f0")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("letter-spacing", "1px")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.8)");

    simulation.on("tick", () => {
      // Update Lines
      linkGroup
        .attr("x1", d => (d.source as NetworkNode).x!)
        .attr("y1", d => (d.source as NetworkNode).y!)
        .attr("x2", d => (d.target as NetworkNode).x!)
        .attr("y2", d => (d.target as NetworkNode).y!);

      // Update Nodes
      nodeGroup
        .attr("transform", d => `translate(${d.x},${d.y})`);

      // Update Particles
      particleCircles
        .attr("cx", d => {
          d.t += d.speed;
          if (d.t > 1) d.t = 0;
          const sx = (d.link.source as NetworkNode).x!;
          const tx = (d.link.target as NetworkNode).x!;
          return sx + (tx - sx) * d.t;
        })
        .attr("cy", d => {
          const sy = (d.link.source as NetworkNode).y!;
          const ty = (d.link.target as NetworkNode).y!;
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

    return () => {
      simulation.stop();
    };
  }, []);

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
         <div ref={containerRef} className="w-full h-full cursor-move bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
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
               <MetricRow label="Total Hubs" value="4" />
               <MetricRow label="Active Routes" value="12" />
               <MetricRow label="Uptime" value="99.9%" />
            </div>
          </div>
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