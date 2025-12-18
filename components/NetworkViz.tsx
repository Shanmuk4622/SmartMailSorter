import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
}

const NetworkViz: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 400;
    const height = 300;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("class", "w-full h-full");

    // Mock Data representing a sorting network
    const nodes: Node[] = [
      { id: "Hub-Central", group: 1 },
      { id: "SC-NY-01", group: 2 },
      { id: "SC-CA-04", group: 2 },
      { id: "SC-TX-02", group: 2 },
      { id: "SC-FL-08", group: 2 },
      { id: "Local-NY-A", group: 3 },
      { id: "Local-NY-B", group: 3 },
      { id: "Local-CA-A", group: 3 },
    ];

    const links: Link[] = [
      { source: "Hub-Central", target: "SC-NY-01", value: 5 },
      { source: "Hub-Central", target: "SC-CA-04", value: 5 },
      { source: "Hub-Central", target: "SC-TX-02", value: 5 },
      { source: "Hub-Central", target: "SC-FL-08", value: 3 },
      { source: "SC-NY-01", target: "Local-NY-A", value: 2 },
      { source: "SC-NY-01", target: "Local-NY-B", value: 2 },
      { source: "SC-CA-04", target: "Local-CA-A", value: 2 },
    ];

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(50))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value));

    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.group === 1 ? 10 : (d.group === 2 ? 7 : 4))
      .attr("fill", d => d.group === 1 ? "#3b82f6" : (d.group === 2 ? "#10b981" : "#64748b"));

    node.append("title")
      .text(d => d.id);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node
        .attr("cx", d => (d as any).x)
        .attr("cy", d => (d as any).y);
    });

    return () => {
      simulation.stop();
    };
  }, []);

  return <svg ref={svgRef} className="w-full h-full bg-slate-50 rounded-lg shadow-inner" />;
};

export default NetworkViz;