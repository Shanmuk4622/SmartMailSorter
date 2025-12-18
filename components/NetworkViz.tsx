import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Zap, Clock, AlertCircle } from 'lucide-react';

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

    // Define Gradients
    const defs = svg.append("defs");
    
    // Active Gradient
    const activeGrad = defs.append("linearGradient").attr("id", "grad-active").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
    activeGrad.append("stop").attr("offset", "0%").style("stop-color", "#34d399"); // emerald-400
    activeGrad.append("stop").attr("offset", "100%").style("stop-color", "#059669"); // emerald-600

    // Busy Gradient
    const busyGrad = defs.append("linearGradient").attr("id", "grad-busy").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
    busyGrad.append("stop").attr("offset", "0%").style("stop-color", "#f87171"); // red-400
    busyGrad.append("stop").attr("offset", "100%").style("stop-color", "#dc2626"); // red-600

    // Idle Gradient
    const idleGrad = defs.append("linearGradient").attr("id", "grad-idle").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
    idleGrad.append("stop").attr("offset", "0%").style("stop-color", "#94a3b8"); // slate-400
    idleGrad.append("stop").attr("offset", "100%").style("stop-color", "#64748b"); // slate-500


    // Data
    const nodes: NetworkNode[] = [
      { id: "HUB-NYC", type: "HUB", status: "busy", label: "New York Central" },
      { id: "HUB-CHI", type: "HUB", status: "active", label: "Chicago Hub" },
      { id: "HUB-LAX", type: "HUB", status: "active", label: "Los Angeles Hub" },
      { id: "HUB-MIA", type: "HUB", status: "idle", label: "Miami Hub" },
      
      { id: "LOC-BK", type: "LOCAL", status: "busy", label: "Brooklyn Dist." },
      { id: "LOC-QN", type: "LOCAL", status: "active", label: "Queens Dist." },
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

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d) => d.target.type === 'LOCAL' ? 80 : 200))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    const link = svg.append("g")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value) * 1.5)
      .attr("stroke-dasharray", d => (d.target as NetworkNode).status === 'busy' ? "4 4" : "0");

    // Animate busy links
    // Note: D3 animation in React useEffect can be tricky, simpler to use CSS class if possible, 
    // but here we just render static for now or use basic attr tweening.

    const nodeGroup = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Glow effect for hubs
    nodeGroup.append("circle")
      .attr("r", d => d.type === 'HUB' ? 35 : 0)
      .attr("fill", d => {
        if (d.status === 'active') return "rgba(16, 185, 129, 0.2)";
        if (d.status === 'busy') return "rgba(244, 63, 94, 0.2)";
        return "transparent";
      })
      .attr("class", "pulse-circle");

    // Main Node Circle
    nodeGroup.append("circle")
      .attr("r", d => d.type === 'HUB' ? 18 : 10)
      .attr("fill", d => `url(#grad-${d.status})`)
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .attr("class", "cursor-pointer transition-all hover:stroke-blue-200")
      .on("click", (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      });

    // Label
    nodeGroup.append("text")
      .text(d => d.type === 'HUB' ? d.id.split('-')[1] : '')
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("fill", "#fff")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as NetworkNode).x!)
        .attr("y1", d => (d.source as NetworkNode).y!)
        .attr("x2", d => (d.target as NetworkNode).x!)
        .attr("y2", d => (d.target as NetworkNode).y!);

      nodeGroup
        .attr("transform", d => `translate(${d.x},${d.y})`);
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
    <div className="flex h-full gap-6">
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
         <div className="absolute top-6 left-6 z-10">
           <h2 className="text-2xl font-bold text-slate-800">Network Topology</h2>
           <p className="text-slate-500 text-sm">Real-time connection status</p>
         </div>
         
         {/* Graph Container */}
         <div ref={containerRef} className="w-full h-full bg-slate-50/30">
           <svg ref={svgRef} className="w-full h-full"></svg>
         </div>

         {/* Legend */}
         <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-100 flex flex-col gap-2">
           <div className="flex items-center gap-2 text-sm text-slate-600">
             <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Active Route
           </div>
           <div className="flex items-center gap-2 text-sm text-slate-600">
             <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Congested/Busy
           </div>
           <div className="flex items-center gap-2 text-sm text-slate-600">
             <span className="w-3 h-3 rounded-full bg-slate-400"></span> Idle/Maintenance
           </div>
         </div>
      </div>

      {/* Info Panel */}
      <div className="w-80 flex flex-col gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">System Status</h3>
              <p className="text-indigo-200 text-sm">Live Updates</p>
            </div>
          </div>
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/10">
               <span className="text-sm font-medium">Total Hubs</span>
               <span className="font-bold text-xl">4</span>
             </div>
             <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/10">
               <span className="text-sm font-medium">Active Links</span>
               <span className="font-bold text-xl">12</span>
             </div>
             <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl border border-white/10">
               <span className="text-sm font-medium">Throughput</span>
               <span className="font-bold text-xl">98%</span>
             </div>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-slate-400" />
            Node Details
          </h3>
          {selectedNode ? (
            <div className="animate-fade-in space-y-4">
              <div className={`p-4 rounded-xl border-l-4 ${
                selectedNode.status === 'active' ? 'bg-emerald-50 border-emerald-500' :
                selectedNode.status === 'busy' ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-400'
              }`}>
                <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">{selectedNode.type}</p>
                <p className="text-xl font-bold text-slate-800">{selectedNode.label}</p>
                <p className="text-sm mt-1 capitalize font-medium opacity-80">{selectedNode.status}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Queue</p>
                  <p className="font-mono font-bold text-slate-700">{Math.floor(Math.random() * 500)} items</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Latency</p>
                  <p className="font-mono font-bold text-slate-700">{Math.floor(Math.random() * 20) + 5}ms</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
              <RefreshCw className="w-12 h-12 mb-3 opacity-20" />
              <p>Select a node on the graph to view real-time metrics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkViz;