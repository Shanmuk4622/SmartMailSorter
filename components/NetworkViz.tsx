import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Zap, Server, Activity, Database, Play, Pause, RotateCcw, ZoomIn, ZoomOut, Maximize2, X, Filter, Clock, Wifi } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ScanResult, MailData } from '../types';
import { sampleData, sortingCenterLocations } from '../sampleData';
import { createPortal } from 'react-dom';
import MapViz from './MapViz';
import NetworkStatsPanel from './NetworkStatsPanel';

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'HUB' | 'LOCAL';
  status: 'active' | 'busy' | 'idle' | 'error';
  label: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  // Enhanced properties
  throughput?: number; // messages/hour
  latency?: number; // ms
  connections?: number;
  lastSeen?: string;
  version?: string;
  load?: number; // 0-100%
  // Geographic properties for real data integration
  city?: string;
  state?: string;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  value: number;
  // Enhanced properties
  bandwidth?: number; // Mbps
  utilization?: number; // 0-100%
  packets?: number;
  errors?: number;
  status?: 'healthy' | 'degraded' | 'down';
}

interface Particle {
  link: NetworkLink;
  t: number; // 0 to 1 (progress along link)
  speed: number;
}

// small helper
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
// normalize a string to an alphanumeric lowercase key for robust matching
const normalizeKey = (s?: string) => (String(s || '')).toLowerCase().replace(/[^a-z0-9]/g, '');

const NetworkViz: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });
  const [metrics, setMetrics] = useState({ 
    totalHubs: 0, 
    activeRoutes: 0, 
    uptime: '99.9%',
    totalThroughput: 0,
    avgLatency: 0,
    errorRate: 0,
    totalScans: 0,
    successRate: 0,
    avgProcessingTime: 0
  });
  
  const [realScanData, setRealScanData] = useState<ScanResult[]>([]);
  const [networkStats, setNetworkStats] = useState<{
    sortingCenters: Array<{
      id: string;
      name: string;
      city?: string;
      state?: string;
      country?: string;
      scanCount: number;
      successRate: number;
      avgProcessingTime: number;
      lastActivity: string;
    }>;
    routes: Array<{
      from: string;
      to: string;
      volume: number;
      avgTime: number;
    }>;
  }>({ sortingCenters: [], routes: [] });
  
  // Enhanced controls
  const [isPlaying, setIsPlaying] = useState(true);
  const [showHubsOnly, setShowHubsOnly] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h'|'24h'|'7d'>('24h');
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'network' | 'map'>('network');
  
  // Layout controls
  const [chargeStrength, setChargeStrength] = useState<number>(-400);
  const [linkDistanceBase, setLinkDistanceBase] = useState<number>(200);
  const [dynamicLayout, setDynamicLayout] = useState(true);
  const [hubPositionsOverride, setHubPositionsOverride] = useState<Record<string, { x: number; y: number }> | null>(null);
  const [hubLabelOverride, setHubLabelOverride] = useState<Record<string, string> | null>(null);
  
  const zoomBehaviorRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Helper Components
  const MetricRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-300 font-medium">{label}</span>
      <span className="font-bold text-emerald-400 font-mono">{value}</span>
    </div>
  );

  // Fetch real data from Supabase
  const fetchRealNetworkData = async () => {
    try {
      console.log('🔄 Fetching network data from Supabase...');
      const { data: scanData, error } = await supabase
        .from('mail_scans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      let scansToProcess: ScanResult[];
      
      if (error) {
        console.error('❌ Error fetching scan data:', error);
        console.log('📊 Using sample data for demo');
        scansToProcess = sampleData;
      } else if (!scanData || scanData.length === 0) {
        console.log('📊 No scan data found, using sample data for demo');
        scansToProcess = sampleData;
      } else {
        console.log(`✅ Found ${scanData.length} real scans, processing...`);
        // Convert database records to ScanResult format
        scansToProcess = scanData.map(record => ({
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

      setRealScanData(scansToProcess);

      // Process data to extract network topology
      const centerStats = new Map<string, {
        id: string;
        name: string;
        city?: string;
        state?: string;
        country?: string;
        scans: ScanResult[];
        successCount: number;
        processingTimes: number[];
        lastActivity: number;
      }>();

      // Group scans by sorting center
      scansToProcess.forEach(scan => {
        if (!scan.data) return;
        
        const centerId = scan.data.sorting_center_id || 'unknown';
        const centerName = scan.data.sorting_center_name || centerId;
        
        if (!centerStats.has(centerId)) {
          centerStats.set(centerId, {
            id: centerId,
            name: centerName,
            city: scan.data.city,
            state: scan.data.state,
            country: scan.data.country,
            scans: [],
            successCount: 0,
            processingTimes: [],
            lastActivity: new Date().getTime() - Math.random() * 86400000 // Random time in last 24h
          });
        }

        const center = centerStats.get(centerId)!;
        center.scans.push(scan);
        if (scan.status === 'completed') center.successCount++;
        if (scan.processingTimeMs) center.processingTimes.push(scan.processingTimeMs);
        
        // Update last activity if this scan is newer
        const scanTime = scan.timestamp;
        if (scanTime > center.lastActivity) {
          center.lastActivity = scanTime;
        }
      });

      // Convert to network stats format
      const sortingCenters = Array.from(centerStats.values()).map(center => ({
        id: center.id,
        name: center.name,
        city: center.city,
        state: center.state,
        country: center.country,
        scanCount: center.scans.length,
        successRate: center.scans.length > 0 ? center.successCount / center.scans.length : 0,
        avgProcessingTime: center.processingTimes.length > 0 
          ? center.processingTimes.reduce((a, b) => a + b, 0) / center.processingTimes.length
          : 0,
        lastActivity: new Date(center.lastActivity).toISOString()
      }));

      // Create routes based on common destinations
      const routes: Array<{ from: string; to: string; volume: number; avgTime: number; }> = [];
      const routeMap = new Map<string, { volume: number; times: number[]; }>();

      // Analyze mail flow patterns
      scansToProcess.forEach(scan => {
        if (!scan.data) return;
        const from = scan.data.sorting_center_id || 'unknown';
        const to = scan.data.city || 'destination';
        const routeKey = `${from}->${to}`;
        
        if (!routeMap.has(routeKey)) {
          routeMap.set(routeKey, { volume: 0, times: [] });
        }
        
        const route = routeMap.get(routeKey)!;
        route.volume++;
        if (scan.processingTimeMs) route.times.push(scan.processingTimeMs);
      });

      routeMap.forEach((routeData, routeKey) => {
        const [from, to] = routeKey.split('->');
        routes.push({
          from,
          to,
          volume: routeData.volume,
          avgTime: routeData.times.length > 0 
            ? routeData.times.reduce((a, b) => a + b, 0) / routeData.times.length
            : 0
        });
      });

      setNetworkStats({ sortingCenters, routes });

      // Calculate real metrics
      const totalScans = scansToProcess.length;
      const successfulScans = scansToProcess.filter(s => s.status === 'completed').length;
      const failedScans = scansToProcess.filter(s => s.status === 'failed').length;
      const processingTimes = scansToProcess
        .filter(s => s.processingTimeMs)
        .map(s => s.processingTimeMs!);

      const now = new Date();
      const recentScans = scansToProcess.filter(s => {
        const scanTime = new Date(s.timestamp || 0);
        return (now.getTime() - scanTime.getTime()) < 24 * 60 * 60 * 1000; // Last 24 hours
      });

      setMetrics({
        totalHubs: centerStats.size,
        activeRoutes: routes.length,
        uptime: '99.9%', // Could be calculated from system logs
        totalThroughput: recentScans.length, // Scans per day
        avgLatency: processingTimes.length > 0 
          ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
          : 0,
        errorRate: totalScans > 0 ? failedScans / totalScans : 0,
        totalScans,
        successRate: totalScans > 0 ? successfulScans / totalScans : 0,
        avgProcessingTime: processingTimes.length > 0 
          ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
          : 0
      });

    } catch (error) {
      console.error('Failed to fetch real network data:', error);
    }
  };

  // Fetch real data on component mount
  useEffect(() => {
    fetchRealNetworkData();
    
    // Set up real-time subscription for new scans
    const subscription = supabase
      .channel('mail_scans_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mail_scans'
      }, () => {
        fetchRealNetworkData(); // Refresh data when new scans arrive
      })
      .subscribe();

    // Listen for CSV import events
    const handleCsvImport = () => {
      console.log('🔄 CSV data imported detected, refreshing network visualization...');
      setTimeout(() => {
        fetchRealNetworkData();
      }, 1000); // Delay to ensure database has time to process
    };
    
    const handleDataRefresh = () => {
      console.log('🔄 General data refresh triggered...');
      fetchRealNetworkData();
    };
    
    window.addEventListener('csvDataImported', handleCsvImport);
    window.addEventListener('dataRefresh', handleDataRefresh);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('csvDataImported', handleCsvImport);
      window.removeEventListener('dataRefresh', handleDataRefresh);
    };
  }, []);

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

    // Enhanced Data with performance metrics - Generate from real data
    const nodes: NetworkNode[] = networkStats.sortingCenters.length > 0 
      ? networkStats.sortingCenters.map(center => {
          const isHub = center.scanCount > 50; // Consider high-volume centers as hubs
          const recentActivity = new Date(center.lastActivity);
          const hoursAgo = (new Date().getTime() - recentActivity.getTime()) / (1000 * 60 * 60);
          
          let status: 'active' | 'busy' | 'idle' | 'error';
          if (center.successRate < 0.8) status = 'error';
          else if (hoursAgo > 2) status = 'idle';
          else if (center.scanCount > 100) status = 'busy';
          else status = 'active';

          return {
            id: center.id,
            label: center.name.length > 15 ? center.name.substring(0, 12) + '...' : center.name,
            type: isHub ? 'HUB' : 'LOCAL',
            status,
            throughput: center.scanCount * 24, // Extrapolate to daily volume
            latency: Math.round(center.avgProcessingTime),
            connections: networkStats.routes.filter(r => r.from === center.id || r.to === center.id).length,
            load: Math.min(95, Math.round((center.scanCount / 200) * 100)), // Normalize load percentage
            version: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 10)}`, // Could be stored in DB
            lastSeen: center.lastActivity,
            city: center.city,
            state: center.state,
            country: center.country
          };
        })
      : [
          // Fallback data if no real data available
          { 
            id: "DEMO-001", type: "HUB", status: "active", label: "Demo Hub",
            throughput: 1200, latency: 25, connections: 5, load: 45,
            lastSeen: new Date().toISOString(), version: "v2.1.0"
          }
        ];

    // Apply label overrides from logs when available. Use normalized alphanumeric
    // keys and token matching to increase the chance of matching log-provided
    // sorting center ids/names to the node ids/labels in the visualization.
    if (hubLabelOverride) {
      const entries = Object.entries(hubLabelOverride || {});
      nodes.forEach(n => {
        // helper to attempt to apply a matching override
        for (const [k, v] of entries) {
          if (!k) continue;
          const kn = normalizeKey(k);
          const idn = normalizeKey(n.id);
          const labn = normalizeKey(n.label);

          if (!kn) continue;
          // exact normalized matches
          if (kn === idn || kn === labn) { n.label = v; break; }

          // substring/containment matches (either direction)
          if (idn.includes(kn) || labn.includes(kn) || kn.includes(idn) || kn.includes(labn)) { n.label = v; break; }

          // token match: if any token from node.label equals the key
          const tokens = (n.label || '').split(/\s+/).map(t => normalizeKey(t)).filter(Boolean);
          if (tokens.includes(kn)) { n.label = v; break; }
        }
      });
    }

    // Generate real links from routing data
    const links: NetworkLink[] = [];
    
    // Create connections based on real mail flow patterns
    networkStats.routes.forEach(route => {
      const sourceNode = nodes.find(n => n.id === route.from);
      const targetExists = nodes.some(n => n.id === route.to || n.city === route.to);
      
      if (sourceNode && targetExists) {
        // Find target node (could be by ID or city name)
        const targetNode = nodes.find(n => n.id === route.to) || 
                          nodes.find(n => n.city === route.to);
        
        if (targetNode && targetNode.id !== sourceNode.id) {
          const utilization = Math.min(0.95, route.volume / 100); // Normalize utilization
          let status: 'healthy' | 'degraded' | 'down';
          
          if (utilization > 0.8) status = 'degraded';
          else if (route.avgTime > 5000) status = 'degraded'; // High processing time
          else status = 'healthy';
          
          links.push({
            source: sourceNode.id,
            target: targetNode.id,
            value: Math.min(10, Math.max(1, route.volume / 10)), // Normalize for visualization
            bandwidth: route.volume * 10, // Approximate bandwidth based on volume
            utilization,
            packets: route.volume,
            errors: Math.round(route.volume * (1 - ((sourceNode.throughput || 0) > 0 ? (sourceNode.throughput || 0) / ((sourceNode.throughput || 0) + 100) : 0.9))), // Estimate errors
            status
          });
        }
      }
    });
    
    // If no real routing data, create basic hub connections from the sorting centers
    if (links.length === 0 && nodes.length > 1) {
      const hubs = nodes.filter(n => n.type === 'HUB');
      const locals = nodes.filter(n => n.type === 'LOCAL');
      
      // Connect hubs to each other
      for (let i = 0; i < hubs.length; i++) {
        for (let j = i + 1; j < hubs.length; j++) {
          links.push({
            source: hubs[i].id,
            target: hubs[j].id,
            value: Math.max(1, ((hubs[i].throughput || 0) + (hubs[j].throughput || 0)) / 1000),
            bandwidth: ((hubs[i].throughput || 0) + (hubs[j].throughput || 0)),
            utilization: Math.random() * 0.6 + 0.2,
            packets: (hubs[i].throughput || 0) + (hubs[j].throughput || 0),
            errors: Math.round(Math.random() * 5),
            status: 'healthy'
          });
        }
      }
      
      // Connect locals to nearest hub (by name similarity or region)
      locals.forEach(local => {
        const nearestHub = hubs.reduce((nearest, hub) => {
          // Simple distance heuristic based on name or could use geo data
          const localRegion = local.state || local.city || '';
          const hubRegion = hub.state || hub.city || hub.label;
          const similarity = localRegion.toLowerCase().includes(hubRegion.toLowerCase()) ? 10 : 
                            Math.random() * 5;
          return similarity > (nearest ? nearest.similarity : 0) ? { hub, similarity } : nearest;
        }, null as { hub: NetworkNode; similarity: number; } | null);
        
        if (nearestHub) {
          links.push({
            source: nearestHub.hub.id,
            target: local.id,
            value: Math.max(1, (local.throughput || 0) / 500),
            bandwidth: (local.throughput || 0),
            utilization: (local.load || 0) / 100,
            packets: (local.throughput || 0),
            errors: Math.round((1 - ((local.throughput || 0) > 0 ? 0.95 : 0.8)) * (local.throughput || 0)),
            status: local.status === 'error' ? 'degraded' : 'healthy'
          });
        }
      });
    }

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
        let pos = (hubPositions as any)[n.id];
        // If not a direct key match, try normalized/key-token matching against override keys
        if (!pos) {
          const matchKey = Object.keys(hubPositions || {}).find(k => {
            const kn = normalizeKey(k);
            const idn = normalizeKey(n.id);
            const labn = normalizeKey(n.label);
            return kn && (kn === idn || kn === labn || idn.includes(kn) || labn.includes(kn) || kn.includes(idn) || kn.includes(labn));
          });
          if (matchKey) pos = (hubPositions as any)[matchKey];
        }

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

    // Apply filtering if showHubsOnly is enabled
    const filteredNodes = showHubsOnly ? nodes.filter(n => n.type === 'HUB') : nodes;
    const filteredLinks = showHubsOnly 
      ? links.filter(l => {
          const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const targetId = typeof l.target === 'object' ? l.target.id : l.target;
          return nodes.find(n => n.id === sourceId)?.type === 'HUB' || 
                 nodes.find(n => n.id === targetId)?.type === 'HUB';
        })
      : links;

    // Initialize Particles
    const particles: Particle[] = [];
    filteredLinks.forEach(link => {
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

    const simulation = d3.forceSimulation(filteredNodes)
      .force("link", d3.forceLink(filteredLinks).id((d: any) => d.id).distance((d: any) => {
        // d.target may be an id (string) during initialization — resolve to node if needed
        const targetNode: NetworkNode | undefined = typeof d.target === 'object'
          ? d.target as NetworkNode
          : filteredNodes.find(n => n.id === d.target);
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
      .data(filteredLinks)
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
        if (d.status === 'error') return "#fbbf24"; // Amber
        return "#94a3b8"; // Slate
      })
      .attr("stroke-width", 2)
      .style("filter", "url(#glow)")
      .attr("class", "cursor-pointer transition-all hover:stroke-white")
      .on("click", (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      })
      .on("mouseover", (event, d) => {
        // Highlight connected links
        linkGroup.attr("opacity", l => {
          const source = typeof l.source === 'object' ? l.source.id : l.source;
          const target = typeof l.target === 'object' ? l.target.id : l.target;
          return (source === d.id || target === d.id) ? 0.8 : 0.2;
        });
      })
      .on("mouseout", () => {
        // Reset all link opacity
        linkGroup.attr("opacity", 0.45);
      });

    // Inner Status Dot
    nodeGroup.append("circle")
      .attr("r", d => d.type === 'HUB' ? 4 : 2)
      .attr("fill", d => {
        if (d.status === 'active') return "#10b981";
        if (d.status === 'busy') return "#f43f5e";
        if (d.status === 'error') return "#fbbf24";
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
      if (!isPlaying) return; // Only update when playing
      
      // Randomly tweak link values and particle speeds to simulate traffic
      links.forEach(l => {
        const jitter = (Math.random() - 0.4) * 1.2;
        l.value = Math.max(1, Math.min(12, (l.value || 3) + jitter));
        
        // Update link-specific metrics
        if (l.bandwidth) l.bandwidth = Math.max(100, l.bandwidth + (Math.random() - 0.5) * 50);
        if (l.utilization !== undefined) l.utilization = Math.max(0.1, Math.min(0.95, l.utilization + (Math.random() - 0.5) * 0.1));
        if (l.packets) l.packets = Math.max(0, l.packets + Math.floor((Math.random() - 0.3) * 100));
      });
      
      // Update node metrics
      nodes.forEach(node => {
        if (node.throughput) node.throughput = Math.max(100, node.throughput + (Math.random() - 0.5) * 500);
        if (node.latency) node.latency = Math.max(5, node.latency + (Math.random() - 0.5) * 10);
        if (node.load !== undefined) {
          node.load = Math.max(5, Math.min(95, node.load + (Math.random() - 0.5) * 10));
          // Update status based on load
          if (node.load > 80) node.status = 'busy';
          else if (node.load > 60) node.status = 'active';
          else if (Math.random() < 0.05) node.status = 'error';
          else node.status = 'active';
        }
        if (node.connections) node.connections = Math.max(1, node.connections + Math.floor((Math.random() - 0.5) * 2));
        node.lastSeen = new Date().toISOString();
      });
      
      particleCircles.data().forEach((p: any) => {
        p.speed = 0.002 + Math.random() * 0.006 + (p.link.value || 0) * 0.0003;
      });
      
      // Update link stroke widths to reflect new values and show traffic
      linkGroup.data(links).attr("stroke-width", d => {
        const baseWidth = 1 + Math.sqrt(d.value);
        const trafficMultiplier = showTraffic ? (1 + (d.utilization || 0.5)) : 1;
        return baseWidth * trafficMultiplier;
      })
      .attr("stroke", d => {
        if (showTraffic) {
          const util = d.utilization || 0.5;
          if (util > 0.8) return "#f43f5e"; // High utilization - red
          if (util > 0.6) return "#fbbf24"; // Medium utilization - yellow  
          return "#10b981"; // Low utilization - green
        }
        return "#334155"; // Default color
      });

      // Update real-time metrics (only update dynamic values, keep actual data)
      if (isPlaying) {
        // Add small variations to simulate real-time changes
        const currentMetrics = { ...metrics };
        
        // Very small variations to show it's "live"
        if (currentMetrics.totalThroughput > 0) {
          currentMetrics.totalThroughput += Math.floor((Math.random() - 0.5) * 10);
        }
        if (currentMetrics.avgLatency > 0) {
          currentMetrics.avgLatency += Math.floor((Math.random() - 0.5) * 5);
          currentMetrics.avgLatency = Math.max(0, currentMetrics.avgLatency);
        }
        
        setMetrics(currentMetrics);
      }
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
  }, [dynamicLayout, chargeStrength, linkDistanceBase, hubPositionsOverride, hubLabelOverride, showHubsOnly, showTraffic, isPlaying]);

  const networkVisualizationContent = (
    <div className="flex flex-col h-full gap-4">
      {/* Enhanced Control Panel */}
      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-700 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-2 rounded-lg transition-colors ${isPlaying ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'} hover:bg-emerald-500`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className="text-xs text-slate-300 font-medium">
            {isPlaying ? 'Live' : 'Paused'}
          </span>
        </div>

        <div className="h-6 w-px bg-slate-600"></div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <button
            onClick={() => setShowHubsOnly(!showHubsOnly)}
            className={`px-3 py-1 text-xs rounded ${showHubsOnly ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            Hubs Only
          </button>
          <button
            onClick={() => setShowTraffic(!showTraffic)}
            className={`px-3 py-1 text-xs rounded ${showTraffic ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}
          >
            Traffic
          </button>
        </div>

        <div className="h-6 w-px bg-slate-600"></div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-xs bg-slate-700 text-slate-200 px-2 py-1 rounded border border-slate-600"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
            aria-label="Expand"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-4">
        {/* Main Network Visualization */}
        <div className="flex-1 bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden relative">
           {/* Top Gradient Line */}
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>
           
           <div className="absolute top-4 left-4 z-10">
             <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
               <Database className="w-5 h-5 text-[#FF6600]" />
               भारतीय डाक नेटवर्क | MAIL PROCESSING NETWORK
             </h3>
             <p className="text-slate-400 text-xs font-mono mt-1">लाइव डेटा | LIVE_DATA /// {networkStats.sortingCenters.filter(n => n.scanCount > 0).length}/{networkStats.sortingCenters.length} केंद्र सक्रिय | CENTERS_ACTIVE</p>
             
             <div className="flex gap-2 mt-3 pointer-events-auto">
               <button
                 onClick={() => setViewMode('network')}
                 className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                   viewMode === 'network' ? 'bg-[#FF6600] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                 }`}
               >
                 नेटवर्क दृश्य | Network
               </button>
               <button
                 onClick={() => setViewMode('map')}
                 className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                   viewMode === 'map' ? 'bg-[#FF6600] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                 }`}
               >
                 मानचित्र | Map
               </button>
               <button
                 onClick={() => (window as any).importCSVData?.()}
                 className="px-3 py-1 rounded text-xs font-medium bg-[#138808] text-white hover:bg-green-700 transition-colors"
                 title="Import sample CSV data"
               >
                 📊 डेटा आयात | Import
               </button>
             </div>
           </div>

           {/* Simplified Top-right Indicators */}
           <div className="absolute top-4 right-4 z-10 flex flex-col gap-1">
             <div className="bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-600 text-xs text-slate-200">
               <div className="flex items-center gap-2">
                 <Wifi className="w-3 h-3 text-green-400" />
                 <span className="text-green-300">LIVE</span>
               </div>
             </div>
             <div className="bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-600 text-xs text-slate-200">
               <div className="flex items-center gap-2">
                 <Clock className="w-3 h-3 text-blue-400" />
                 <span className="text-blue-300">Real-time</span>
               </div>
             </div>
           </div>
           
           {/* Dynamic View Container with bottom padding for panels */}
           {viewMode === 'network' ? (
             <div ref={containerRef} className={`w-full cursor-move bg-gradient-to-b from-slate-900/50 via-slate-950 to-black ${isExpanded ? 'h-[calc(100vh-320px)]' : 'h-[380px]'} mb-24`}>
               <svg ref={svgRef} className="w-full h-full"></svg>
             </div>
           ) : (
             <div className={`w-full bg-slate-900 rounded-lg overflow-hidden ${isExpanded ? 'h-[calc(100vh-320px)]' : 'h-[380px]'} mb-24`}>
               <MapViz />
             </div>
           )}
           
           {/* Network Stats Panel - Bottom-left */}
           <div className="absolute bottom-4 left-4 z-20">
             <NetworkStatsPanel 
               metrics={metrics}
               sortingCenters={networkStats.sortingCenters}
               isExpanded={isExpanded}
             />
           </div>
           
           {/* Enhanced Legend - Bottom-right */}
           <div className="absolute bottom-4 right-4 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-700 space-y-2 z-20">
             <div className="text-xs font-bold text-slate-300 mb-2">NODE STATUS</div>
             <div className="flex items-center gap-2 text-xs text-slate-300">
               <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span> Active
             </div>
             <div className="flex items-center gap-2 text-xs text-slate-300">
               <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185] animate-pulse"></span> High Load
             </div>
             <div className="flex items-center gap-2 text-xs text-slate-300">
               <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span> Error
             </div>
             <div className="flex items-center gap-2 text-xs text-slate-300">
               <span className="w-2 h-2 rounded-full bg-slate-400"></span> Idle
             </div>
             <div className="border-t border-slate-700 pt-2 mt-2">
               <div className="flex items-center gap-2 text-xs text-slate-300">
                 <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]"></span> Data Flow
               </div>
             </div>
           </div>

           {/* Performance Indicators */}
           <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700 min-w-[200px]">
             <div className="text-xs font-bold text-slate-300 mb-2">SYSTEM HEALTH</div>
             <div className="space-y-1">
               <div className="flex justify-between items-center text-xs text-slate-200">
                 <span>Centers</span>
                 <span className="font-mono text-emerald-400">{metrics.totalHubs}</span>
               </div>
               <div className="flex justify-between items-center text-xs text-slate-200">
                 <span>Routes</span>
                 <span className="font-mono">{metrics.activeRoutes}</span>
               </div>
               <div className="flex justify-between items-center text-xs text-slate-200">
                 <span>Success Rate</span>
                 <span className="font-mono text-emerald-400">{(metrics.successRate * 100).toFixed(1)}%</span>
               </div>
             </div>
           </div>
        </div>

        {/* Enhanced Side Panel */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* System Status Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-xl border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Server className="w-20 h-20" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="font-bold text-sm">Network Overview</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-400 mb-1">Total Throughput</div>
                  <div className="font-bold text-white">{(metrics.totalThroughput / 1000).toFixed(1)}k/h</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-400 mb-1">Avg Latency</div>
                  <div className="font-bold text-white">{metrics.avgLatency}ms</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-400 mb-1">Error Rate</div>
                  <div className="font-bold text-white">{(metrics.errorRate * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-2">
                  <div className="text-slate-400 mb-1">Uptime</div>
                  <div className="font-bold text-emerald-400">{metrics.uptime}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Node Details Panel */}
          {selectedNode && (
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-700 text-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    {selectedNode.type === 'HUB' ? <Database className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                    {selectedNode.label}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">{selectedNode.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    selectedNode.status === 'active' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' :
                    selectedNode.status === 'busy' ? 'bg-rose-400 shadow-[0_0_8px_#fb7185]' :
                    selectedNode.status === 'error' ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' :
                    'bg-slate-400'
                  } ${selectedNode.status !== 'idle' ? 'animate-pulse' : ''}`}></span>
                  <span className="text-xs font-medium capitalize">{selectedNode.status}</span>
                  <span className="text-xs text-slate-400">Load: {selectedNode.load}%</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400 mb-1">Throughput</div>
                    <div className="font-mono text-white">{selectedNode.throughput?.toLocaleString() || 0}/h</div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400 mb-1">Latency</div>
                    <div className="font-mono text-white">{selectedNode.latency || 0}ms</div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400 mb-1">Connections</div>
                    <div className="font-mono text-white">{selectedNode.connections || 0}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded p-2">
                    <div className="text-slate-400 mb-1">Version</div>
                    <div className="font-mono text-white text-xs">{selectedNode.version || 'N/A'}</div>
                  </div>
                </div>

                {selectedNode.lastSeen && (
                  <div className="text-xs text-slate-400">
                    Last seen: {new Date(selectedNode.lastSeen).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Layout Controls */}
          <div className="bg-slate-900/90 rounded-2xl p-4 text-white border border-slate-700">
            <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Controls
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Dynamic Layout</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={dynamicLayout} 
                    onChange={(e) => setDynamicLayout(e.target.checked)} 
                  />
                  <div className={`w-8 h-4 rounded-full transition-colors ${dynamicLayout ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-200 ${dynamicLayout ? 'translate-x-4' : 'translate-x-0.5'} translate-y-0.5`}></div>
                  </div>
                </label>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setChargeStrength(chargeStrength - 50)}
                  className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
                >
                  Closer
                </button>
                <button 
                  onClick={() => setChargeStrength(chargeStrength + 50)}
                  className="flex-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded"
                >
                  Spread
                </button>
              </div>
              
              <button
                onClick={() => {
                  setChargeStrength(-400);
                  setLinkDistanceBase(200);
                  setDynamicLayout(true);
                }}
                className="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Layout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Testing Panel - Bottom of container */}
      <div className="mt-4">
        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl p-4 border border-purple-500/30 backdrop-blur-sm max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-purple-400">
              <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"></path>
              <path d="M8.5 2h7"></path>
              <path d="M14.5 16h-5"></path>
            </svg>
            <h4 className="text-sm font-semibold text-white">Real-time Testing</h4>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-center">
            <button 
              onClick={() => (window as any).importCSVData?.()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Database className="w-4 h-4" />
              Load Sample Data
            </button>
            <button 
              onClick={() => {
                // Simulate a new scan
                window.dispatchEvent(new CustomEvent('testScanAdded', {
                  detail: { center: 'TEST-' + Date.now(), scans: Math.floor(Math.random() * 50) + 1 }
                }));
                fetchRealNetworkData();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Activity className="w-4 h-4" />
              Add Test Scan
            </button>
          </div>
          <p className="text-slate-400 text-sm mt-3 text-center">Use these buttons to test real-time data updates in NetworkViz and MapViz. Watch the visualizations update automatically!</p>
        </div>
      </div>
    </div>
  );

  if (isExpanded && typeof window !== 'undefined') {
    return createPortal(
      <div 
        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col"
        style={{ isolation: 'isolate' }}
      >
        <div className="flex items-center justify-between p-4 bg-slate-900/80 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Network Topology & Status - Full Screen</h2>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            aria-label="Exit full screen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {networkVisualizationContent}
        </div>
      </div>,
      document.body
    );
  }

  return networkVisualizationContent;
}

export default NetworkViz;