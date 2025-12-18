import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface MapNode {
  id: string;
  x: number; // 0-100 relative coordinate
  y: number; // 0-100 relative coordinate
  label: string;
  status: 'active' | 'busy' | 'idle';
}

const MapViz: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Mock Geographical Data (Abstracted for India)
  const nodes: MapNode[] = [
    { id: 'DL', x: 30, y: 20, label: 'Delhi Hub', status: 'busy' },
    { id: 'MH', x: 20, y: 55, label: 'Mumbai Hub', status: 'active' },
    { id: 'KA', x: 35, y: 80, label: 'Bengaluru Hub', status: 'active' },
    { id: 'TN', x: 40, y: 85, label: 'Chennai Hub', status: 'idle' },
    { id: 'WB', x: 70, y: 45, label: 'Kolkata Hub', status: 'active' },
    { id: 'AS', x: 85, y: 35, label: 'Guwahati Hub', status: 'active' },
    { id: 'TS', x: 40, y: 60, label: 'Hyderabad Hub', status: 'busy' },
    { id: 'MP', x: 45, y: 45, label: 'Bhopal Hub', status: 'idle' },
  ];

  const links = [
    { source: 'DL', target: 'MH' },
    { source: 'DL', target: 'WB' },
    { source: 'MH', target: 'KA' },
    { source: 'MH', target: 'MP' },
    { source: 'KA', target: 'TN' },
    { source: 'KA', target: 'TS' },
    { source: 'TS', target: 'WB' },
    { source: 'WB', target: 'AS' },
    { source: 'DL', target: 'MP' },
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
    
    // Initial size
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
    const padding = 20;

    // Scale functions
    // Map abstract 0-100 coordinates to pixels
    const xScale = d3.scaleLinear().domain([0, 100]).range([padding, width - padding]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([padding, height - padding]);

    // Draw Map Background (Abstract shape)
    const mapGroup = svg.append("g").attr("class", "map-bg");
    
    // Draw Links
    const linkGroup = svg.append("g").attr("class", "links");
    
    linkGroup.selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("x1", d => xScale(nodes.find(n => n.id === d.source)?.x || 0))
      .attr("y1", d => yScale(nodes.find(n => n.id === d.source)?.y || 0))
      .attr("x2", d => xScale(nodes.find(n => n.id === d.target)?.x || 0))
      .attr("y2", d => yScale(nodes.find(n => n.id === d.target)?.y || 0))
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4 4");

    // Draw Nodes
    const nodeGroup = svg.append("g").attr("class", "nodes");
    
    const node = nodeGroup.selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${xScale(d.x)}, ${yScale(d.y)})`);

    // Pulse effect for busy nodes
    node.filter(d => d.status === 'busy')
      .append("circle")
      .attr("r", 15)
      .attr("fill", "#3b82f6")
      .attr("opacity", 0.2)
      .append("animate")
      .attr("attributeName", "r")
      .attr("from", "6")
      .attr("to", "20")
      .attr("dur", "1.5s")
      .attr("repeatCount", "indefinite");
      
     node.filter(d => d.status === 'busy')
      .selectAll("circle") // select the circle just appended to add opacity animation
      .append("animate")
      .attr("attributeName", "opacity")
      .attr("from", "0.6")
      .attr("to", "0")
      .attr("dur", "1.5s")
      .attr("repeatCount", "indefinite");

    // Node Circle
    node.append("circle")
      .attr("r", 6)
      .attr("fill", d => {
        if (d.status === 'busy') return "#3b82f6"; // Blue
        if (d.status === 'active') return "#10b981"; // Emerald
        return "#94a3b8"; // Slate
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Labels
    node.append("text")
      .text(d => d.label)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#475569")
      .attr("font-weight", "500")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(255,255,255,1)");

    // Tooltip interaction (simple title)
    node.append("title")
      .text(d => `${d.label} - Status: ${d.status.toUpperCase()}`);

  }, [dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 rounded-lg shadow-inner relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>
      <svg ref={svgRef} className="w-full h-full relative z-10" />
      
      {/* Legend */}
      <div className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-md shadow-sm text-xs border border-slate-200 z-20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div> High Load
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Active
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-400"></div> Idle
        </div>
      </div>
    </div>
  );
};

export default MapViz;