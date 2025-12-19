import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { Radio, Crosshair, Wifi, Maximize2, X, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const originRectRef = useRef<DOMRect | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [showBusyOnly, setShowBusyOnly] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h'|'7d'|'30d'>('24h');
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const currentTransformRef = useRef<any>(d3.zoomIdentity);
  const zoomLayerElRef = useRef<SVGGElement | null>(null);

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

  // Handle Resize (including full screen resizes)
  useEffect(() => {
    const getActiveContainer = () => {
      if (isExpanded) {
        // In full screen mode, use the screen dimensions
        return {
          offsetWidth: window.innerWidth,
          offsetHeight: window.innerHeight
        };
      }
      return containerRef.current;
    };

    let raf = 0;
    const update = () => {
      const container = getActiveContainer();
      if (!container) return;
      
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      setDimensions((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    schedule();

    // Observe element size changes when not expanded
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && !isExpanded) {
      const el = containerRef.current;
      if (el) {
        ro = new ResizeObserver(() => schedule());
        ro.observe(el);
      }
    }

    // Always listen for window resize (for full screen mode)
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('resize', schedule);
      if (ro) ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [isExpanded]);

  // Lock body scroll when expanded and add full screen class
  useEffect(() => {
    if (isExpanded) {
      const prevOverflow = document.body.style.overflow;
      const prevPosition = document.body.style.position;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'relative';
      return () => { 
        document.body.style.overflow = prevOverflow; 
        document.body.style.position = prevPosition;
      };
    }
    return;
  }, [isExpanded]);

  // Expand/contract with portal-based full screen
  const animateExpandToggle = (expand: boolean) => {
    if (expand) {
      const el = containerRef.current;
      if (el) {
        originRectRef.current = el.getBoundingClientRect();
      }
      setOverlayVisible(true);
      setIsExpanded(true);
      
      // Focus management for accessibility
      setTimeout(() => {
        try {
          const closeBtn = document.querySelector('[aria-label="Close map"]') as HTMLElement;
          if (closeBtn && closeBtn.focus) closeBtn.focus();
        } catch (e) {}
      }, 100);
    } else {
      setSelectedNode(null);
      setIsExpanded(false);
      setOverlayVisible(false);
      currentTransformRef.current = d3.zoomIdentity;
      
      // Return focus to expand button
      setTimeout(() => {
        try {
          const expandBtn = containerRef.current?.querySelector('[aria-label="Expand map"]') as HTMLElement;
          if (expandBtn && expandBtn.focus) expandBtn.focus();
        } catch (e) {}
      }, 100);
    }
  };

  // Close on Escape and trap focus inside the modal when expanded
  useEffect(() => {
    if (!isExpanded) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        animateExpandToggle(false);
        return;
      }

      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;

      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!active || active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isExpanded]);

  // Draw D3 and wire interactions (zoom / drag / tooltip)
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;

    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);
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

    // Ensure SVG sizing is in sync with container
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');

    // --- LAYERS ---
    
    // create zoomable layer
    const zoomLayer = svg.append('g').attr('class', 'zoom-layer');
    zoomLayerElRef.current = zoomLayer.node();

    // 1. Grid Background
    const gridGroup = zoomLayer.append("g").attr("class", "grid-lines").attr("opacity", 0.15);
    // Vertical lines
    for (let i = 0; i <= 10; i++) {
      gridGroup.append("line")
        .attr("x1", i * (width / 10))
        .attr("y1", 0)
        .attr("x2", i * (width / 10))
        .attr("y2", height)
        .attr("stroke", "#475569")
        .attr("stroke-width", i % 5 === 0 ? 0.8 : 0.4);
    }
    // Horizontal lines
    for (let i = 0; i <= 10; i++) {
      gridGroup.append("line")
        .attr("x1", 0)
        .attr("y1", i * (height / 10))
        .attr("x2", width)
        .attr("y2", i * (height / 10))
        .attr("stroke", "#475569")
        .attr("stroke-width", i % 5 === 0 ? 0.8 : 0.4);
    }

    // 2. Links
    const linkGroup = zoomLayer.append("g").attr("class", "links");
    
    // Traffic Particles Group
    const trafficGroup = zoomLayer.append("g").attr("class", "traffic");

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
          .attr("stroke", "#475569")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "3 6")
          .attr("opacity", 0.6)
          .style("filter", "drop-shadow(0 0 2px rgba(71, 85, 105, 0.5))");

        // Animate Particle path
        const path = trafficGroup.append("path")
          .attr("d", `M${x1},${y1} L${x2},${y2}`)
          .attr("fill", "none")
          .attr("stroke", "none");

        // Moving Particle
        const circle = trafficGroup.append("circle")
          .attr("r", 3)
          .attr("fill", "#3b82f6") // Blue-500
          .style("filter", "url(#map-glow) drop-shadow(0 0 4px #3b82f6)");

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
            .attr("r", 3)
            .attr("fill", "#8b5cf6") // Violet-500
            .style("filter", "url(#map-glow) drop-shadow(0 0 4px #8b5cf6)");
           
           circleRev.append("animateMotion")
            .attr("dur", `${duration * 1.5}ms`)
            .attr("repeatCount", "indefinite")
            .attr("path", `M${x2},${y2} L${x1},${y1}`);
        }
      }
    });

    // 3. Nodes
    const nodeGroup = zoomLayer.append("g").attr("class", "nodes");
    
    // Optionally filter nodes based on toolbar state
    const filteredNodes = nodes.filter(n => {
      if (showBusyOnly && n.status !== 'busy') return false;
      if (showActiveOnly && n.status !== 'active') return false;
      return true;
    });

    const nodeSelection = nodeGroup.selectAll("g")
      .data(filteredNodes)
      .enter()
      .append("g")
      .attr("transform", d => `translate(${xScale(d.x)}, ${yScale(d.y)})`)
      .style('cursor', 'grab')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      })
      .on('mouseover', (event, d) => {
        const tt = tooltipRef.current;
        if (!tt) return;
        tt.style.display = 'block';
        tt.innerText = `${d.label} — ${d.status.toUpperCase()} — ${d.traffic}%`;
      })
      .on('mousemove', (event) => {
        const tt = tooltipRef.current;
        if (!tt) return;
        tt.style.left = `${event.clientX + 12}px`;
        tt.style.top = `${event.clientY + 12}px`;
      })
      .on('mouseout', () => {
        const tt = tooltipRef.current;
        if (!tt) return;
        tt.style.display = 'none';
      });

    // Drag behavior for nodes
    const dragBehavior = d3.drag<SVGGElement, MapNode>()
      .on('start', function (event, d) {
        d3.select(this).style('cursor', 'grabbing');
      })
      .on('drag', function (event, d) {
        const [mx, my] = d3.pointer(event, svgEl);
        d3.select(this).attr('transform', `translate(${mx}, ${my})`);
        try {
          d.x = xScale.invert(mx);
          d.y = yScale.invert(my);
        } catch (e) {}
      })
      .on('end', function (event, d) {
        d3.select(this).style('cursor', 'grab');
      });

    nodeSelection.call(dragBehavior as any);

    // Outer Radar Ring (for busy nodes)
    // For busy nodes, append an animated ring (two <animate> children on the circle)
    const busyCircles = nodeSelection.filter(d => d.status === 'busy')
      .append("circle")
      .attr("r", 25)
      .attr("fill", "none")
      .attr("stroke", "#f43f5e") // Rose
      .attr("stroke-width", 1)
      .attr("opacity", 0)
      .style("pointer-events", "none");

    busyCircles.append("animate")
      .attr("attributeName", "r")
      .attr("from", "5")
      .attr("to", "35")
      .attr("dur", "2s")
      .attr("repeatCount", "indefinite");

    busyCircles.append("animate")
      .attr("attributeName", "opacity")
      .attr("from", "0.5")
      .attr("to", "0")
      .attr("dur", "2s")
      .attr("repeatCount", "indefinite");

    // Node Body
    nodeSelection.append("circle")
      .attr("r", d => d.traffic > 50 ? 8 : 6)
      .attr("fill", "#1e293b") // Slate-800
      .attr("stroke", d => {
        if (d.status === 'busy') return "#ef4444"; // Red-500
        if (d.status === 'active') return "#22c55e"; // Green-500
        return "#64748b"; // Slate-500
      })
      .attr("stroke-width", 3)
      .style("filter", "url(#map-glow) drop-shadow(0 2px 4px rgba(0,0,0,0.3))");

    // Node Label Background
    nodeSelection.append("rect")
      .attr("x", -35)
      .attr("y", -30)
      .attr("width", 70)
      .attr("height", 16)
      .attr("rx", 6)
      .attr("fill", "#1e293b")
      .attr("stroke", "#475569")
      .attr("stroke-width", 1)
      .attr("opacity", 0.9)
      .style("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.3))");

    // Node Label
    nodeSelection.append("text")
      .text(d => d.id)
      .attr("y", -18)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#f1f5f9")
      .attr("font-weight", "600")
      .attr("font-family", "monospace")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.5)");

  }, [dimensions, showBusyOnly, showActiveOnly]);

  // Zoom behavior attached to svg (enabled while expanded for better UX)
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0) return;
    const svgEl = svgRef.current;
    const svg = d3.select(svgEl);

    const getZoomLayer = () => {
      if (zoomLayerElRef.current) return d3.select(zoomLayerElRef.current);
      const z = svg.select<SVGGElement>('.zoom-layer');
      if (!z.empty()) {
        zoomLayerElRef.current = z.node();
        return z;
      }
      return null;
    };

    // Wait for DOM to be ready after SVG redraw
    const zl0 = getZoomLayer();
    if (!zl0) {
      setTimeout(() => {
        // Retry after a tick when zoom layer is available
        if (getZoomLayer()) {
          const retryBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 6])
            .on('zoom', (event: any) => {
              const zl = getZoomLayer();
              if (zl) {
                zl.attr('transform', event.transform);
                currentTransformRef.current = event.transform;
              }
            });
          zoomBehaviorRef.current = retryBehavior;
          if (isExpanded) {
            d3.select(svgEl).call(retryBehavior as any);
          }
        }
      }, 10);
      return;
    }

    const zoomed = (event: any) => {
      const zl = getZoomLayer();
      if (!zl) return;
      zl.attr('transform', event.transform);
      currentTransformRef.current = event.transform;
    };

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 6])
      .on('zoom', zoomed as any);

    // expose zoom behavior so UI buttons can control it
    zoomBehaviorRef.current = zoomBehavior;

    if (isExpanded) {
      d3.select(svgEl).call(zoomBehavior as any);
      // seed current transform from any existing state
      try { 
        const existing = d3.zoomTransform(svgEl);
        if (existing && existing.k !== 1) {
          currentTransformRef.current = existing;
        }
      } catch (e) {}
    } else {
      // disable zoom and reset
      const zl = getZoomLayer();
      if (zl) zl.attr('transform', null as any);
      d3.select(svgEl).on('.zoom', null as any);
      try { (svgEl as any).__zoom = d3.zoomIdentity; } catch (e) {}
      currentTransformRef.current = d3.zoomIdentity;
    }

    return () => { d3.select(svgEl).on('.zoom', null as any); };
  }, [isExpanded, dimensions]);

  // Programmatic zoom handlers (used by toolbar buttons)
  const zoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    try {
      const svgEl = svgRef.current;
      const behavior = zoomBehaviorRef.current;
      const sel = d3.select(svgEl);
      
      // Ensure zoom behavior is attached
      if (!sel.property('__zoom')) {
        sel.call(behavior);
      }
      
      // Use transition for smooth zoom
      sel.transition().duration(250).call(
        behavior.scaleBy as any, 1.4
      );
    } catch (e) {
      console.warn('Zoom in failed:', e);
    }
  };

  const zoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    try {
      const svgEl = svgRef.current;
      const behavior = zoomBehaviorRef.current;
      const sel = d3.select(svgEl);
      
      // Ensure zoom behavior is attached
      if (!sel.property('__zoom')) {
        sel.call(behavior);
      }
      
      // Use transition for smooth zoom
      sel.transition().duration(250).call(
        behavior.scaleBy as any, 1 / 1.4
      );
    } catch (e) {
      console.warn('Zoom out failed:', e);
    }
  };

  const resetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    try {
      const svgEl = svgRef.current;
      const behavior = zoomBehaviorRef.current;
      const sel = d3.select(svgEl);
      
      // Ensure zoom behavior is attached
      if (!sel.property('__zoom')) {
        sel.call(behavior);
      }
      
      // Reset to identity transform
      sel.transition().duration(250).call(
        behavior.transform as any, d3.zoomIdentity
      );
    } catch (e) {
      console.warn('Zoom reset failed:', e);
    }
  };

  // Setup tooltip element (only once)
  useEffect(() => {
    if (tooltipRef.current) return;
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.padding = '6px 8px';
    el.style.background = 'rgba(15,23,42,0.95)';
    el.style.color = '#e2e8f0';
    el.style.fontSize = '12px';
    el.style.borderRadius = '6px';
    el.style.display = 'none';
    el.style.zIndex = '10005';
    document.body.appendChild(el);
    tooltipRef.current = el;
    return () => { try { el.remove(); } catch (e) {} };
  }, []);

  // Export helpers: SVG -> SVG file and PNG
  const exportSvg = async () => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    // Add name spaces.
    if(!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if(!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartmail-map.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportPng = async () => {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if(!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = svgEl.clientWidth || dimensions.width || 1200;
      const h = svgEl.clientHeight || dimensions.height || 800;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0,0,w,h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'smartmail-map.png';
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  };

  return (
    <>
      {/* Regular container when not expanded */}
      <div
        ref={containerRef}
        onClick={(e) => { 
          if (!isExpanded && e.target === e.currentTarget) setSelectedNode(null); 
        }}
        className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-xl relative overflow-hidden group transition-all duration-300"
      >
        {!isExpanded && (
          <>
            {/* 1. Radar Sweep Overlay */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
               <div className="w-full h-full bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,transparent_280deg,rgba(16,185,129,0.4)_320deg,transparent_360deg)] animate-[spin_6s_linear_infinite] rounded-full scale-125 origin-center"></div>
            </div>
            
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-5">
              <div className="w-full h-full" style={{
                backgroundImage: `
                  linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }}></div>
            </div>

            {/* 2. Abstract Map SVG */}
            <svg ref={svgRef} className="w-full h-full relative z-10" />

            {/* 3. Tech Overlay UI */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs font-bold bg-emerald-950/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-emerald-800/50 shadow-lg">
                 <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                 LIVE_FEED
              </div>
              <div className="text-[10px] text-slate-400 font-mono bg-slate-900/60 backdrop-blur-sm px-2 py-1 rounded border border-slate-700/50">
                 LAT: 28.6139 N <br/>
                 LON: 77.2090 E
              </div>
            </div>

            <div className="absolute bottom-4 left-4 z-20 bg-slate-900/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50 shadow-lg">
               <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
                  <Wifi className="w-3 h-3 text-blue-400" />
                  <span>Network Load: 78%</span>
               </div>
               <div className="w-32 h-2 bg-slate-800 mt-2 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 w-[78%] animate-pulse rounded-full"></div>
               </div>
            </div>

            {/* 4. Legend */}
            <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-600/50 z-20 shadow-2xl">
              <div className="text-[11px] font-bold text-slate-300 uppercase mb-3 tracking-wider">Node Status</div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span> Active
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185] animate-pulse"></span> Congested
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-200">
                   <span className="w-2 h-2 rounded-full bg-slate-400 shadow-[0_0_4px_#94a3b8]"></span> Idle
                </div>
              </div>
            </div>

            {/* 5. Center Crosshair Decorative */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-700 opacity-30 pointer-events-none">
              <Crosshair className="w-32 h-32 stroke-[0.5] drop-shadow-sm" />
            </div>
          </>
        )}

        {/* Expand button - always visible */}
        <button
          aria-label="Expand map"
          onClick={(e) => { e.stopPropagation(); animateExpandToggle(true); }}
          className="absolute top-4 right-4 z-50 p-3 rounded-lg transition-colors border bg-slate-800/70 text-slate-100 hover:bg-slate-700 border-slate-700"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Full Screen Portal */}
      {isExpanded && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          role="dialog"
          aria-modal="true"
          aria-label="Live map expanded view"
          onClick={(e) => { 
            if (e.target === e.currentTarget) {
              setSelectedNode(null);
            }
          }}
        >
          {/* Full screen content */}
          <div className="w-full h-full relative">
            {/* 1. Radar Sweep Overlay */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
               <div className="w-full h-full bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,transparent_280deg,rgba(16,185,129,0.4)_320deg,transparent_360deg)] animate-[spin_6s_linear_infinite] rounded-full scale-125 origin-center"></div>
            </div>
            
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-5">
              <div className="w-full h-full" style={{
                backgroundImage: `
                  linear-gradient(rgba(59,130,246,0.1) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(59,130,246,0.1) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px'
              }}></div>
            </div>

            {/* 2. Full Screen SVG */}
            <svg 
              ref={isExpanded ? svgRef : undefined} 
              className="w-full h-full relative z-10" 
            />

            {/* Close Button */}
            <button
              aria-label="Close map"
              onClick={(e) => { e.stopPropagation(); animateExpandToggle(false); }}
              className="absolute top-4 right-4 z-50 p-3 rounded-lg transition-colors border bg-slate-900/90 text-white hover:bg-slate-800 border-white/20 shadow-lg backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 3. Tech Overlay UI */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs font-bold bg-emerald-950/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-emerald-800/50 shadow-lg">
                 <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                 LIVE_FEED
              </div>
              <div className="text-[10px] text-slate-400 font-mono bg-slate-900/60 backdrop-blur-sm px-2 py-1 rounded border border-slate-700/50">
                 LAT: 28.6139 N <br/>
                 LON: 77.2090 E
              </div>
            </div>

            {/* 4a. Fullscreen Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[min(95%,1200px)] px-4 py-2 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-3 pointer-events-auto">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-200 font-semibold">Filters</label>
                <button onClick={() => { setShowBusyOnly(s => !s); }} className={`px-2 py-1 rounded ${showBusyOnly ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-200'}`}>Busy</button>
                <button onClick={() => { setShowActiveOnly(s => !s); }} className={`px-2 py-1 rounded ${showActiveOnly ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-200'}`}>Active</button>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <label className="text-xs text-slate-200 font-semibold">Time</label>
                <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)} className="text-xs bg-white/5 text-slate-200 px-3 py-1 rounded">
                  <option value="24h">Last 24h</option>
                  <option value="7d">Last 7d</option>
                  <option value="30d">Last 30d</option>
                </select>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <button aria-label="Zoom in" onClick={zoomIn} className="p-2 rounded bg-white/5 hover:bg-white/10 text-slate-100">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button aria-label="Zoom out" onClick={zoomOut} className="p-2 rounded bg-white/5 hover:bg-white/10 text-slate-100">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button aria-label="Reset zoom" onClick={resetZoom} className="p-2 rounded bg-white/5 hover:bg-white/10 text-slate-100">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={exportSvg} className="text-xs bg-white/10 px-3 py-1 rounded text-slate-100 hover:bg-white/20">Export SVG</button>
                <button onClick={exportPng} className="text-xs bg-blue-500 px-3 py-1 rounded text-white hover:bg-blue-600">Export PNG</button>
                <button onClick={() => animateExpandToggle(false)} className="text-xs ml-2 bg-white px-2 py-1 rounded text-slate-900 shadow-sm">Close</button>
              </div>
            </div>

            {/* Node Info Panel */}
            {selectedNode && (
              <div className="absolute top-20 right-8 z-50 bg-white/6 backdrop-blur-md p-4 rounded-lg border border-white/10 w-64 text-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{selectedNode.label} <span className="text-xs text-slate-400">({selectedNode.id})</span></div>
                    <div className="text-xs text-slate-300 mt-1">Status: <span className={`${selectedNode.status === 'active' ? 'text-emerald-300' : selectedNode.status === 'busy' ? 'text-rose-300' : 'text-slate-400'}`}>{selectedNode.status}</span></div>
                    <div className="text-xs text-slate-300 mt-1">Traffic: <span className="font-mono">{selectedNode.traffic}%</span></div>
                  </div>
                  <div>
                    <button aria-label="Close node info" onClick={() => setSelectedNode(null)} className="p-1 rounded-md bg-white/10 hover:bg-white/20">
                      <X className="w-4 h-4 text-slate-100" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-300">More details could go here (last scan time, recent errors, pinned notes).</div>
              </div>
            )}

            {/* Network Load */}
            <div className="absolute bottom-4 left-4 z-20 bg-slate-900/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50 shadow-lg">
               <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
                  <Wifi className="w-3 h-3 text-blue-400" />
                  <span>Network Load: 78%</span>
               </div>
               <div className="w-32 h-2 bg-slate-800 mt-2 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 w-[78%] animate-pulse rounded-full"></div>
               </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-600/50 z-20 shadow-2xl">
              <div className="text-[11px] font-bold text-slate-300 uppercase mb-3 tracking-wider">Node Status</div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span> Active
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185] animate-pulse"></span> Congested
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-200">
                   <span className="w-2 h-2 rounded-full bg-slate-400 shadow-[0_0_4px_#94a3b8]"></span> Idle
                </div>
              </div>
            </div>

            {/* Center Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-700 opacity-30 pointer-events-none">
              <Crosshair className="w-32 h-32 stroke-[0.5] drop-shadow-sm" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default MapViz;