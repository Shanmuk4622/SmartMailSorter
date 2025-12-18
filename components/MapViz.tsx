import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Radio, Crosshair, Wifi } from 'lucide-react';

interface MapNode {
  id: string;
  x: number; // 0-100 relative coordinate
  y: number; // 0-100 relative coordinate
  label: string;
  status: 'active' | 'busy' | 'idle';
  traffic: number; // 0-100 load
}

const MapViz: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Geographical Data (Abstracted positions)
  const nodes: MapNode[] = [
    { id: 'DL', x: 30, y: 20, label: 'North Hub', status: 'busy', traffic: 85 },
    { id: 'MH', x: 25, y: 55, label: 'West Hub', status: 'active', traffic: 45 },
    { id: 'KA', x: 35, y: 75, label: 'South Hub', status: 'active', traffic: 60 },
    { id: 'TN', x: 45, y: 80, label: 'Coastal Hub', status: 'idle', traffic: 10 },
    { id: 'WB', x: 70, y: 45, label: 'East Hub', status: 'active', traffic: 30 },
    { id: 'AS', x: 85, y: 35, label: 'N.East Hub', status: 'active', traffic: 25 },
    { id: 'TS', x: 40, y: 60, label: 'Central Hub', status: 'busy', traffic: 78 },
  ];

  const links = [
    { source: 'DL', target: 'MH' },
    { source: 'DL', target: 'WB' },
    { source: 'MH', target: 'KA' },
    { source: 'MH', target: 'TS' },
    { source: 'KA', target: 'TN' },
    { source: 'KA', target: 'TS' },
    { source: 'TS', target: 'WB' },
    { source: 'WB', target: 'AS' },
    { source: 'DL', target: 'TS' },
  ];

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Draw D3
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const { width, height } = dimensions;
    const padding = 40;

    // Define Filters (Glows)
    const defs = svg.append("defs");
    
    // Blue Glow
    const filter = defs.append("filter").attr("id", "map-glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Scales
    const xScale = d3.scaleLinear().domain([0, 100]).range([padding, width - padding]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([padding, height - padding]);

    // --- LAYERS ---
    
    // 1. Grid Background
    const gridGroup = svg.append("g").attr("class", "grid-lines").attr("opacity", 0.1);
    // Vertical lines
    for (let i = 0; i <= 10; i++) {
      gridGroup.append("line")
        .attr("x1", i * (width / 10))
        .attr("y1", 0)
        .attr("x2", i * (width / 10))
        .attr("y2", height)
        .attr("stroke", "#94a3b8");
    }
    // Horizontal lines
    for (let i = 0; i <= 10; i++) {
      gridGroup.append("line")
        .attr("x1", 0)
        .attr("y1", i * (height / 10))
        .attr("x2", width)
        .attr("y2", i * (height / 10))
        .attr("stroke", "#94a3b8");
    }

    // 2. Links
    const linkGroup = svg.append("g").attr("class", "links");
    
    // Traffic Particles Group
    const trafficGroup = svg.append("g").attr("class", "traffic");

    links.forEach((link, i) => {
      const sourceNode = nodes.find(n => n.id === link.source);
      const targetNode = nodes.find(n => n.id === link.target);

      if (sourceNode && targetNode) {
        const x1 = xScale(sourceNode.x);
        const y1 = yScale(sourceNode.y);
        const x2 = xScale(targetNode.x);
        const y2 = yScale(targetNode.y);

        // Draw Line
        linkGroup.append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("stroke", "#334155")
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "2 4")
          .attr("opacity", 0.5);

        // Animate Particle path
        const path = trafficGroup.append("path")
          .attr("d", `M${x1},${y1} L${x2},${y2}`)
          .attr("fill", "none")
          .attr("stroke", "none");

        // Moving Particle
        const circle = trafficGroup.append("circle")
          .attr("r", 2)
          .attr("fill", "#60a5fa") // Blue-400
          .style("filter", "url(#map-glow)");

        // Animate traffic
        const length = Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
        const duration = 2000 + Math.random() * 2000; // Random speed

        circle.append("animateMotion")
          .attr("dur", `${duration}ms`)
          .attr("repeatCount", "indefinite")
          .attr("path", `M${x1},${y1} L${x2},${y2}`);
          
        // Reverse traffic occasionally
        if (i % 2 === 0) {
           const circleRev = trafficGroup.append("circle")
            .attr("r", 2)
            .attr("fill", "#818cf8") // Indigo-400
            .style("filter", "url(#map-glow)");
           
           circleRev.append("animateMotion")
            .attr("dur", `${duration * 1.5}ms`)
            .attr("repeatCount", "indefinite")
            .attr("path", `M${x2},${y2} L${x1},${y1}`);
        }
      }
    });

    // 3. Nodes
    const nodeGroup = svg.append("g").attr("class", "nodes");
    
    const nodeSelection = nodeGroup.selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${xScale(d.x)}, ${yScale(d.y)})`);

    // Outer Radar Ring (for busy nodes)
    nodeSelection.filter(d => d.status === 'busy')
      .append("circle")
      .attr("r", 25)
      .attr("fill", "none")
      .attr("stroke", "#f43f5e") // Rose
      .attr("stroke-width", 1)
      .attr("opacity", 0)
      .append("animate")
        .attr("attributeName", "r")
        .attr("from", "5")
        .attr("to", "35")
        .attr("dur", "2s")
        .attr("repeatCount", "indefinite")
      .select(function() { return this.parentNode; }) // Go back to circle
      .append("animate")
        .attr("attributeName", "opacity")
        .attr("from", "0.5")
        .attr("to", "0")
        .attr("dur", "2s")
        .attr("repeatCount", "indefinite");

    // Node Body
    nodeSelection.append("circle")
      .attr("r", d => d.traffic > 50 ? 6 : 4)
      .attr("fill", "#0f172a") // Slate-900
      .attr("stroke", d => {
        if (d.status === 'busy') return "#f43f5e";
        if (d.status === 'active') return "#10b981";
        return "#94a3b8";
      })
      .attr("stroke-width", 2)
      .style("filter", "url(#map-glow)");

    // Node Label Background
    nodeSelection.append("rect")
      .attr("x", -30)
      .attr("y", -25)
      .attr("width", 60)
      .attr("height", 14)
      .attr("rx", 4)
      .attr("fill", "#0f172a")
      .attr("opacity", 0.8);

    // Node Label
    nodeSelection.append("text")
      .text(d => d.id)
      .attr("y", -15)
      .attr("text-anchor", "middle")
      .attr("font-size", "9px")
      .attr("fill", "#e2e8f0")
      .attr("font-weight", "bold")
      .attr("font-family", "monospace");

  }, [dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-900 rounded-2xl shadow-inner relative overflow-hidden group border border-slate-800">
      
      {/* 1. Radar Sweep Overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-10">
         <div className="w-full h-full bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,transparent_300deg,#10b981_360deg)] animate-[spin_4s_linear_infinite] rounded-full scale-150 origin-center"></div>
      </div>

      {/* 2. Abstract Map SVG */}
      <svg ref={svgRef} className="w-full h-full relative z-10" />
      
      {/* 3. Tech Overlay UI */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold bg-emerald-950/50 px-2 py-1 rounded border border-emerald-900">
           <Radio className="w-3 h-3 animate-pulse" />
           LIVE_FEED
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
           LAT: 28.6139 N <br/>
           LON: 77.2090 E
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-20">
         <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Wifi className="w-3 h-3" />
            <span>Network Load: 78%</span>
         </div>
         <div className="w-32 h-1 bg-slate-800 mt-1 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[78%] animate-pulse"></div>
         </div>
      </div>

      {/* 4. Legend */}
      <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700 z-20 shadow-xl">
        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Node Status</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></span> Active
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e] animate-pulse"></span> Congested
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
             <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Idle
          </div>
        </div>
      </div>

      {/* 5. Center Crosshair Decorative */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-800 opacity-20 pointer-events-none">
        <Crosshair className="w-24 h-24 stroke-[0.5]" />
      </div>

    </div>
  );
};

export default MapViz;