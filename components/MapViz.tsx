import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { Radio, Crosshair, Wifi, Maximize2, X, ZoomIn, ZoomOut, RefreshCw, Map as MapIcon, Network } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { sampleData, sortingCenterLocations } from '../sampleData';
import { ScanResult } from '../types';
import GeographicMap from './GeographicMap';

interface MapNode {
  id: string;
  x: number; // 0-100 relative coordinate or actual longitude
  y: number; // 0-100 relative coordinate or actual latitude
  label: string;
  status: 'active' | 'busy' | 'idle';
  traffic: number; // 0-100 load
  city?: string;
  state?: string;
  scanCount?: number;
  lastActivity?: number;
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

  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [scanData, setScanData] = useState<ScanResult[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [mapView, setMapView] = useState<'abstract' | 'geographic'>('geographic'); // Default to geographic
  
  // Fetch and process real data
  const fetchMapData = async () => {
    try {
      console.log('🗺️  Fetching map data from Supabase...');
      const { data: scans, error } = await supabase
        .from('mail_scans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
        
      let scansToProcess: ScanResult[];
      
      if (error || !scans || scans.length === 0) {
        console.log('🗺️  Using sample data for map visualization');
        scansToProcess = sampleData;
      } else {
        console.log(`🗺️  Processing ${scans.length} real scans for map...`);
        // Convert database records to ScanResult format
        scansToProcess = scans.map(record => ({
          id: record.id,
          timestamp: new Date(record.created_at).getTime(),
          data: {
            recipient: record.recipient,
            address: record.address,
            pin_code: record.pin_code,
            city: record.city,
            state: record.state,
            country: record.country,
            sorting_center_id: record.sorting_center_id,
            sorting_center_name: record.sorting_center_name,
            confidence: record.confidence / 100
          },
          status: record.status,
          processingTimeMs: 2000 // Default since not stored
        } as ScanResult));
      }
      
      setScanData(scansToProcess);
      
      // Process scans to create dynamic map nodes
      const centerMap = new Map<string, {
        id: string;
        name: string;
        city: string;
        state?: string;
        scanCount: number;
        successCount: number;
        lastActivity: number;
        lat?: number;
        lng?: number;
      }>();
      
      scansToProcess.forEach(scan => {
        if (scan.data?.sorting_center_id) {
          const centerId = scan.data.sorting_center_id;
          if (!centerMap.has(centerId)) {
            // Try to get location from sample data
            const location = sortingCenterLocations.find(loc => loc.id === centerId);
            centerMap.set(centerId, {
              id: centerId,
              name: scan.data.sorting_center_name || centerId,
              city: scan.data.city,
              state: scan.data.state,
              scanCount: 0,
              successCount: 0,
              lastActivity: 0,
              lat: location?.lat,
              lng: location?.lng
            });
          }
          
          const center = centerMap.get(centerId)!;
          center.scanCount++;
          if (scan.status === 'completed') center.successCount++;
          center.lastActivity = Math.max(center.lastActivity, scan.timestamp || 0);
        }
      });
      
      // Convert to map nodes with dynamic positioning
      const mapNodes: MapNode[] = Array.from(centerMap.values()).map((center, index) => {
        // Calculate traffic based on recent activity
        const hoursAgo = (Date.now() - center.lastActivity) / (1000 * 60 * 60);
        let status: 'active' | 'busy' | 'idle';
        let traffic: number;
        
        if (hoursAgo < 1) {
          status = center.scanCount > 20 ? 'busy' : 'active';
          traffic = Math.min(100, center.scanCount * 5);
        } else if (hoursAgo < 6) {
          status = 'active';
          traffic = Math.min(70, center.scanCount * 3);
        } else {
          status = 'idle';
          traffic = Math.min(30, center.scanCount);
        }
        
        // Use geographic coordinates if available, otherwise distribute
        let x, y;
        if (center.lat && center.lng) {
          // Convert lat/lng to relative coordinates (simplified projection)
          x = ((center.lng + 120) / 60) * 100; // Rough conversion for US
          y = ((45 - center.lat) / 20) * 100;   // Rough conversion for US
        } else {
          // Distribute evenly if no coordinates
          x = 20 + (index % 4) * 20;
          y = 20 + Math.floor(index / 4) * 20;
        }
        
        return {
          id: center.id,
          x: Math.max(5, Math.min(95, x)),
          y: Math.max(5, Math.min(95, y)),
          label: center.name,
          status,
          traffic,
          city: center.city,
          state: center.state,
          scanCount: center.scanCount,
          lastActivity: center.lastActivity
        };
      });
      
      setNodes(mapNodes);
      setLastUpdate(Date.now());
      
    } catch (error) {
      console.error('Error fetching map data:', error);
      // Fallback to sample locations if error
      const fallbackNodes = sortingCenterLocations.map((loc, index) => ({
        id: loc.id,
        x: ((loc.lng + 120) / 60) * 100,
        y: ((45 - loc.lat) / 20) * 100,
        label: loc.name,
        status: loc.status as 'active' | 'busy' | 'idle',
        traffic: loc.traffic,
        city: loc.city,
        state: loc.state,
        scanCount: Math.floor(Math.random() * 50) + 10,
        lastActivity: Date.now() - Math.random() * 86400000
      }));
      setNodes(fallbackNodes);
    }
  };
  
  // Process geographic centers for the map
  const geographicCenters = React.useMemo(() => {
    console.log('🗺️ Processing geographic centers from scanData:', scanData.length, 'scans');
    const centerMap = new Map<string, {
      id: string;
      name: string;
      city: string;
      state?: string;
      scanCount: number;
      successCount: number;
      lastActivity: number;
      lat: number;
      lng: number;
    }>();
    
    scanData.forEach(scan => {
      console.log('🗺️ Processing scan:', scan);
      if (scan.data?.sorting_center_id) {
        const centerId = scan.data.sorting_center_id;
        console.log('🗺️ Found center ID:', centerId);
        if (!centerMap.has(centerId)) {
          // Try to get location from sample data
          const location = sortingCenterLocations.find(loc => loc.id === centerId);
          console.log('🗺️ Found location for center:', location);
          if (location) {
            centerMap.set(centerId, {
              id: centerId,
              name: scan.data.sorting_center_name || centerId,
              city: scan.data.city,
              state: scan.data.state,
              scanCount: 0,
              successCount: 0,
              lastActivity: 0,
              lat: location.lat,
              lng: location.lng
            });
          }
        }
        
        const center = centerMap.get(centerId);
        if (center) {
          center.scanCount++;
          if (scan.status === 'completed') center.successCount++;
          center.lastActivity = Math.max(center.lastActivity, scan.timestamp || 0);
        }
      }
    });
    
    // Convert to geographic centers
    const result = Array.from(centerMap.values()).map(center => {
      const hoursAgo = (Date.now() - center.lastActivity) / (1000 * 60 * 60);
      let status: 'active' | 'busy' | 'idle';
      let traffic: number;
      
      if (hoursAgo < 1) {
        status = center.scanCount > 20 ? 'busy' : 'active';
        traffic = Math.min(100, center.scanCount * 5);
      } else if (hoursAgo < 6) {
        status = 'active';
        traffic = Math.min(70, center.scanCount * 3);
      } else {
        status = 'idle';
        traffic = Math.min(30, center.scanCount);
      }
      
      return {
        id: center.id,
        name: center.name,
        city: center.city,
        state: center.state,
        lat: center.lat,
        lng: center.lng,
        scanCount: center.scanCount,
        lastActivity: center.lastActivity,
        status,
        traffic
      };
    });
    
    console.log('🗺️ Final geographic centers result:', result);
    return result;
  }, [scanData]);
  
  // Initial data fetch and periodic updates
  useEffect(() => {
    fetchMapData();
    
    // Update every 15 seconds for real-time feel
    const interval = setInterval(() => {
      console.log('⏰ Periodic map data refresh...');
      fetchMapData();
    }, 15000);
    
    // Real-time subscription
    const subscription = supabase
      .channel('mail_scans_map')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mail_scans'
      }, (payload) => {
        console.log('🗺️  Real-time update received (Map):', payload.eventType);
        fetchMapData();
      })
      .subscribe((status) => {
        console.log('📡 Map subscription status:', status);
      });
    
    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  // Generate dynamic links based on nodes
  const links = React.useMemo(() => {
    if (nodes.length < 2) return [];
    
    const generatedLinks = [];
    const activeNodes = nodes.filter(n => n.status !== 'idle');
    
    // Connect high-traffic nodes to each other
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        const node1 = activeNodes[i];
        const node2 = activeNodes[j];
        
        // Connect if both have significant traffic and are relatively close
        const distance = Math.sqrt(Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2));
        if (distance < 50 && (node1.traffic > 30 || node2.traffic > 30)) {
          generatedLinks.push({
            source: node1.id,
            target: node2.id
          });
        }
      }
    }
    
    // Also create some hub connections
    const busyNodes = nodes.filter(n => n.status === 'busy');
    busyNodes.forEach(busyNode => {
      const nearbyActive = nodes.filter(n => 
        n.status === 'active' && 
        n.id !== busyNode.id &&
        Math.sqrt(Math.pow(n.x - busyNode.x, 2) + Math.pow(n.y - busyNode.y, 2)) < 40
      );
      
      nearbyActive.slice(0, 2).forEach(nearbyNode => {
        generatedLinks.push({
          source: busyNode.id,
          target: nearbyNode.id
        });
      });
    });
    
    return generatedLinks;
  }, [nodes]);

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

            {/* 2. Conditional Map Content */}
            {mapView === 'geographic' ? (
              <div className="w-full h-full relative z-10">
                <GeographicMap centers={geographicCenters} />
              </div>
            ) : (
              <svg ref={svgRef} className="w-full h-full relative z-10" />
            )}

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

        {/* Controls - always visible */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-800/70 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden">
            <button
              onClick={() => setMapView('geographic')}
              className={`px-2 py-2 text-xs transition-colors flex items-center gap-1 ${
                mapView === 'geographic' 
                  ? 'bg-green-600 text-white' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Geographic View"
            >
              <MapIcon className="w-3 h-3" />
            </button>
            <button
              onClick={() => setMapView('abstract')}
              className={`px-2 py-2 text-xs transition-colors flex items-center gap-1 ${
                mapView === 'abstract' 
                  ? 'bg-purple-600 text-white' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Abstract View"
            >
              <Network className="w-3 h-3" />
            </button>
          </div>
          
          {/* Expand button */}
          <button
            aria-label="Expand map"
            onClick={(e) => { e.stopPropagation(); animateExpandToggle(true); }}
            className="p-3 rounded-lg transition-colors border bg-slate-800/70 text-slate-100 hover:bg-slate-700 border-slate-700"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
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

            {/* 2. Conditional Map Content */}
            {mapView === 'geographic' ? (
              <div className="w-full h-full relative z-10">
                <GeographicMap centers={geographicCenters} />
              </div>
            ) : (
              <svg 
                ref={isExpanded ? svgRef : undefined} 
                className="w-full h-full relative z-10" 
              />
            )}

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
                <label className="text-xs text-slate-200 font-semibold">View</label>
                <button 
                  onClick={() => setMapView('geographic')} 
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs ${mapView === 'geographic' ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-200'}`}
                >
                  <MapIcon className="w-3 h-3" />
                  Geographic
                </button>
                <button 
                  onClick={() => setMapView('abstract')} 
                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs ${mapView === 'abstract' ? 'bg-purple-500 text-white' : 'bg-white/5 text-slate-200'}`}
                >
                  <Network className="w-3 h-3" />
                  Abstract
                </button>
              </div>

              {mapView === 'abstract' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-200 font-semibold">Filters</label>
                  <button onClick={() => { setShowBusyOnly(s => !s); }} className={`px-2 py-1 rounded ${showBusyOnly ? 'bg-rose-500 text-white' : 'bg-white/5 text-slate-200'}`}>Busy</button>
                  <button onClick={() => { setShowActiveOnly(s => !s); }} className={`px-2 py-1 rounded ${showActiveOnly ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-200'}`}>Active</button>
                </div>
              )}

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
                    {selectedNode.city && (
                      <div className="text-xs text-slate-300 mt-1">Location: <span className="font-mono">{selectedNode.city}{selectedNode.state ? `, ${selectedNode.state}` : ''}</span></div>
                    )}
                    {selectedNode.scanCount && (
                      <div className="text-xs text-slate-300 mt-1">Scans: <span className="font-mono text-emerald-300">{selectedNode.scanCount}</span></div>
                    )}
                  </div>
                  <div>
                    <button aria-label="Close node info" onClick={() => setSelectedNode(null)} className="p-1 rounded-md bg-white/10 hover:bg-white/20">
                      <X className="w-4 h-4 text-slate-100" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-300">
                  {selectedNode.lastActivity ? 
                    `Last activity: ${new Date(selectedNode.lastActivity).toLocaleString()}` :
                    'Real-time mail processing center'
                  }
                </div>
              </div>
            )}

            {/* Network Load */}
            <div className="absolute bottom-4 left-4 z-20 bg-slate-900/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700/50 shadow-lg">
               <div className="flex items-center gap-2 text-slate-300 text-xs font-medium">
                  <Wifi className="w-3 h-3 text-blue-400" />
                  <span>Network Load: {Math.round(nodes.reduce((sum, node) => sum + node.traffic, 0) / (nodes.length || 1))}%</span>
               </div>
               <div className="w-32 h-2 bg-slate-800 mt-2 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 animate-pulse rounded-full transition-all duration-1000" 
                    style={{ width: `${Math.round(nodes.reduce((sum, node) => sum + node.traffic, 0) / (nodes.length || 1))}%` }}
                  ></div>
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