"use client";

import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw, ZoomIn, ZoomOut, List, ShieldCheck, Link2 } from "lucide-react";
import { formatMinorUnits } from "../../app/lib/currency";
import { useWorkspaceStore, workspaceStore } from "../../app/lib/workspace-store";
import type { AgentNodeData, AgentEdgeData, CanvasViewFilter } from "./types";
import { Button } from "../ui/button";

export interface AgentNetworkCanvasProps {
  className?: string;
  nodes?: AgentNodeData[];
  edges?: AgentEdgeData[];
  currency?: string;
  onSelectNode?: (nodeId: string) => void;
  onToggleViewMode?: () => void;
  filter?: CanvasViewFilter;
  onFilterChange?: (filter: CanvasViewFilter) => void;
  /** Hide the floating filter pills when a card header hosts them instead. */
  hideFilterControls?: boolean;
  /** Hide the floating "List View" toggle when a card header hosts it instead. */
  hideViewToggle?: boolean;
}

export function AgentNetworkCanvas({
  className = "",
  nodes: propNodes,
  edges: propEdges,
  currency = "USD",
  onSelectNode,
  onToggleViewMode,
  filter = "all",
  onFilterChange,
  hideFilterControls = false,
  hideViewToggle = false,
}: AgentNetworkCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const store = useWorkspaceStore();

  const [activeFilter, setActiveFilter] = React.useState<CanvasViewFilter>(filter);

  // Follow the controlled filter prop so a parent card header can drive it.
  React.useEffect(() => {
    setActiveFilter(filter);
  }, [filter]);

  const effectiveNodes = propNodes ?? store.graphNodes;
  const effectiveEdges = propEdges ?? store.graphEdges;

  // Filter nodes according to active filter
  const filteredNodes = React.useMemo(() => {
    if (activeFilter === "funded") {
      return effectiveNodes.filter((n) => n.isFunded);
    }
    if (activeFilter === "unfunded") {
      return effectiveNodes.filter((n) => !n.isFunded);
    }
    return effectiveNodes;
  }, [effectiveNodes, activeFilter]);

  const filteredNodeIds = React.useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = React.useMemo(() => {
    return effectiveEdges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
    );
  }, [effectiveEdges, filteredNodeIds]);

  // Keep references for animation loop and interaction
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = React.useRef<OrbitControls | null>(null);
  const nodeMeshesRef = React.useRef<Map<string, THREE.Group>>(new Map());
  const pulseRingsRef = React.useRef<
    Array<{ mesh: THREE.Mesh; startTime: number; maxRadius: number }>
  >([]);
  const flowParticlesRef = React.useRef<
    Array<{
      mesh: THREE.Mesh;
      start: THREE.Vector3;
      end: THREE.Vector3;
      speed: number;
      progress: number;
    }>
  >([]);
  const strobeNodesRef = React.useRef<
    Map<string, { mesh: THREE.Mesh; baseColor: THREE.Color; intensity: number }>
  >(new Map());

  // Helper to create crisp high-DPI text canvas sprite with Allocated, Spent, Available
  const createNodeSprite = (node: AgentNodeData, curr: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, 512, 256);

    // Background pill container
    ctx.fillStyle = "rgba(10, 10, 12, 0.92)";
    ctx.strokeStyle = node.isSimulation
      ? "rgba(255, 255, 255, 0.55)"
      : node.isFunded
        ? "rgba(59, 130, 246, 0.5)"
        : "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(14, 14, 484, 228, 24);
    ctx.fill();
    ctx.stroke();

    // Simulation Badge Pill if node is marked as simulation
    if (node.isSimulation) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(166, 22, 180, 24, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#cccccc";
      ctx.font = "bold 13px ui-monospace, SFMono-Regular, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("[SIMULATION]", 256, 34);
    }

    // Node Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.name, 256, node.isSimulation ? 64 : 54);

    // Subtitle Role & Status
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const roleText =
      node.role === "orchestrator" ? "Orchestrator Root" : `Subagent · ${node.status}`;
    ctx.fillText(roleText, 256, node.isSimulation ? 94 : 86);

    // Subtle divider
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 114);
    ctx.lineTo(482, 114);
    ctx.stroke();

    // 3 metrics: ALLOCATED | SPENT | AVAILABLE
    const availMinor =
      node.availableMinor !== undefined
        ? node.availableMinor
        : Math.max(
            0,
            node.allocatedMinor -
              (node.subDelegatedMinor || 0) -
              node.spentMinor -
              node.reservedMinor,
          );

    const allocText = formatMinorUnits(node.allocatedMinor, curr);
    const spentText = formatMinorUnits(node.spentMinor, curr);
    const availText = formatMinorUnits(availMinor, curr);

    // Column 1: Allocated (x: 105)
    ctx.fillStyle = "#71717a";
    ctx.font = "bold 12px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText("ALLOCATED", 105, 140);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(allocText, 105, 172);

    // Column 2: Spent (x: 256)
    ctx.fillStyle = "#71717a";
    ctx.font = "bold 12px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText("SPENT", 256, 140);
    ctx.fillStyle = node.spentMinor > 0 ? "#f97316" : "#a1a1aa";
    ctx.font = "bold 17px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(spentText, 256, 172);

    // Column 3: Available (x: 407)
    ctx.fillStyle = "#71717a";
    ctx.font = "bold 12px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText("AVAILABLE", 407, 140);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 17px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(availText, 407, 172);

    // Bottom Status Pill indicator
    ctx.fillStyle = node.isFunded ? "rgba(59, 130, 246, 0.2)" : "rgba(245, 158, 11, 0.2)";
    ctx.strokeStyle = node.isFunded ? "rgba(59, 130, 246, 0.6)" : "rgba(245, 158, 11, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(176, 204, 160, 22, 11);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = node.isFunded ? "#60a5fa" : "#fbbf24";
    ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
    ctx.fillText(node.isFunded ? "FUNDED & ACTIVE" : "UNFUNDED / READY", 256, 215);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(56, 28, 1);
    sprite.position.set(0, 24, 0);
    return sprite;
  };

  // Build / Rebuild Three.js Scene objects
  const buildGraphScene = React.useCallback(
    (scene: THREE.Scene) => {
      // Clear previous interactive objects
      nodeMeshesRef.current.forEach((group) => scene.remove(group));
      nodeMeshesRef.current.clear();
      pulseRingsRef.current = [];
      flowParticlesRef.current = [];
      strobeNodesRef.current.clear();

      // Remove previous lines & particles
      const toRemove: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj.userData?.isGraphElement) {
          toRemove.push(obj);
        }
      });
      toRemove.forEach((obj) => scene.remove(obj));

      const nodePosMap = new Map<string, THREE.Vector3>();

      // 1. Create Nodes
      filteredNodes.forEach((node) => {
        const group = new THREE.Group();
        group.position.set(...node.position);
        group.userData = { id: node.id, isNode: true, isGraphElement: true };

        nodePosMap.set(node.id, new THREE.Vector3(...node.position));

        // Node plate prism geometry
        const boxGeo = new THREE.BoxGeometry(44, 14, 28);
        const isRevoked = node.status === "revoked";
        const isFunded = node.isFunded && !isRevoked;

        const baseColor = isRevoked
          ? new THREE.Color(0x3f3f46)
          : isFunded
            ? new THREE.Color(0x141414)
            : new THREE.Color(0x18181b);

        const boxMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.5,
          metalness: 0.2,
        });

        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        group.add(boxMesh);

        // Top Face Specular Rim Plate — green tint when funded
        const topGeo = new THREE.PlaneGeometry(42, 26);
        const topMat = new THREE.MeshBasicMaterial({
          color: isRevoked ? 0x71717a : isFunded ? 0x0cce6b : 0x3f3f46,
          transparent: true,
          opacity: isFunded ? 0.35 : 0.15,
        });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.rotation.x = -Math.PI / 2;
        topMesh.position.y = 7.1;
        group.add(topMesh);

        // CRITICAL VISUAL DISTINCTION:
        // Solid outline for funded nodes; Dashed outline for unfunded structural attachments
        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        if (isFunded) {
          // Solid outline
          const lineMat = new THREE.LineBasicMaterial({
            color: 0xd4d4d8,
            linewidth: 1.5,
          });
          const outline = new THREE.LineSegments(edgesGeo, lineMat);
          group.add(outline);
        } else {
          // Dashed outline
          const dashMat = new THREE.LineDashedMaterial({
            color: 0x71717a,
            dashSize: 4,
            gapSize: 3,
          });
          const outline = new THREE.LineSegments(edgesGeo, dashMat);
          outline.computeLineDistances(); // Mandatory for Three.js dashed lines
          group.add(outline);
        }

        // Text sprite
        const sprite = createNodeSprite(node, currency);
        if (sprite) {
          group.add(sprite);
        }

        // Rejection & simulation warning strobe tracker
        if (node.status === "paused" || node.status === "unfunded" || node.isSimulation) {
          strobeNodesRef.current.set(node.id, {
            mesh: boxMesh,
            baseColor,
            intensity: 0,
          });
        }

        scene.add(group);
        nodeMeshesRef.current.set(node.id, group);
      });

      // 2. Create Edges
      filteredEdges.forEach((edge) => {
        const sourcePos = nodePosMap.get(edge.source);
        const targetPos = nodePosMap.get(edge.target);
        if (!sourcePos || !targetPos) return;

        // Curved line curve between source and target
        const midY = (sourcePos.y + targetPos.y) / 2;
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midZ = (sourcePos.z + targetPos.z) / 2 + 15;
        const controlPoint = new THREE.Vector3(midX, midY, midZ);

        const curve = new THREE.QuadraticBezierCurve3(sourcePos, controlPoint, targetPos);
        const points = curve.getPoints(36);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

        const isRejectedFlash = edge.status === "rejected_flash";

        // CRITICAL VISUAL DISTINCTION:
        // Solid line for authorized delegations or active rejected_flash;
        // Dashed line (LineDashedMaterial with computeLineDistances) for unfunded structural attachments.
        if (edge.isAuthorized || isRejectedFlash) {
          const solidMat = new THREE.LineBasicMaterial({
            color: isRejectedFlash ? 0xff6166 : 0xd4d4d8,
            linewidth: isRejectedFlash ? 3 : 2,
            transparent: true,
            opacity: isRejectedFlash ? 1.0 : 0.85,
          });
          const line = new THREE.Line(lineGeo, solidMat);
          line.userData = { isGraphElement: true };
          scene.add(line);

          // Micro-animation: flowing energy particle along edge (red when rejected_flash)
          const particleGeo = new THREE.SphereGeometry(2.5, 12, 12);
          const particleMat = new THREE.MeshBasicMaterial({
            color: isRejectedFlash ? 0xff6166 : 0xffffff,
          });
          const particle = new THREE.Mesh(particleGeo, particleMat);
          particle.userData = { isGraphElement: true };
          scene.add(particle);

          flowParticlesRef.current.push({
            mesh: particle,
            start: sourcePos,
            end: targetPos,
            speed: isRejectedFlash ? 0.02 : 0.008 + Math.random() * 0.004,
            progress: Math.random(),
          });
        } else {
          // Unfunded structural edge: strictly dashed line
          const dashedMat = new THREE.LineDashedMaterial({
            color: 0x52525b,
            dashSize: 5,
            gapSize: 5,
            transparent: true,
            opacity: 0.6,
          });
          const line = new THREE.Line(lineGeo, dashedMat);
          line.computeLineDistances(); // Mandatory for dashed line rendering
          line.userData = { isGraphElement: true };
          scene.add(line);
        }

        // Payment pulse trigger on payment nodes (blue ring)
        if (edge.status === "payment_pulse") {
          const targetNode = filteredNodes.find((n) => n.id === edge.target);
          if (targetNode) {
            const ringGeo = new THREE.RingGeometry(1, 2.5, 32);
            const ringMat = new THREE.MeshBasicMaterial({
              color: 0x0052ff,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.8,
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = -Math.PI / 2;
            ringMesh.position.set(
              targetNode.position[0],
              targetNode.position[1] - 8,
              targetNode.position[2],
            );
            ringMesh.userData = { isGraphElement: true };
            scene.add(ringMesh);

            pulseRingsRef.current.push({
              mesh: ringMesh,
              startTime: performance.now(),
              maxRadius: 40,
            });
          }
        }

        // Rejection pulse trigger on target node when rejected_flash is active (expanding red ripple ring)
        if (edge.status === "rejected_flash") {
          const targetNode = filteredNodes.find((n) => n.id === edge.target);
          if (targetNode) {
            const ringGeo = new THREE.RingGeometry(1, 3, 32);
            const ringMat = new THREE.MeshBasicMaterial({
              color: 0xff6166,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.95,
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = -Math.PI / 2;
            ringMesh.position.set(
              targetNode.position[0],
              targetNode.position[1] - 8,
              targetNode.position[2],
            );
            ringMesh.userData = { isGraphElement: true };
            scene.add(ringMesh);

            pulseRingsRef.current.push({
              mesh: ringMesh,
              startTime: performance.now(),
              maxRadius: 48,
            });
          }
        }
      });
    },
    [filteredNodes, filteredEdges, currency],
  );

  // Initialize Three.js WebGL Scene
  React.useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 560;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent so it seamlessly matches the surrounding bg-zinc-950 pipeline background
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(0, 140, 340);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0); // Transparent clear color
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't go below ground
    controls.minDistance = 80;
    controls.maxDistance = 800;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(100, 200, 150);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Subtle dome emerald rim light
    const pointLight = new THREE.PointLight(0xd4d4d8, 0.5, 400);
    pointLight.position.set(0, 100, 0);
    scene.add(pointLight);

    // Initial build
    buildGraphScene(scene);

    // 6. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      controls.update();

      const time = performance.now();

      // Micro-animation 1: Flow particles traveling along edges
      flowParticlesRef.current.forEach((fp) => {
        fp.progress += fp.speed;
        if (fp.progress > 1) fp.progress = 0;
        fp.mesh.position.lerpVectors(fp.start, fp.end, fp.progress);
        fp.mesh.position.y += Math.sin(fp.progress * Math.PI) * 14;
      });

      // Micro-animation 2: Payment ripple rings expanding and fading
      const now = performance.now();
      pulseRingsRef.current.forEach((pr) => {
        const elapsed = (now - pr.startTime) / 1000;
        const duration = 2.0;
        const progress = Math.min(1, elapsed / duration);

        const currentScale = 1 + progress * 6;
        pr.mesh.scale.set(currentScale, currentScale, 1);

        const mat = pr.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 0.8 * (1 - progress));

        if (progress >= 1) {
          pr.startTime = now; // Loop soft ripple
        }
      });

      // Micro-animation 3: Gentle node floating motion
      nodeMeshesRef.current.forEach((group, id) => {
        const originalNode = filteredNodes.find((n) => n.id === id);
        if (originalNode) {
          const offset = id.charCodeAt(0) * 0.1;
          group.position.y = originalNode.position[1] + Math.sin(time * 0.0015 + offset) * 2;
        }
      });

      // Micro-animation 4: Amber warning strobe for flagged/simulated nodes
      strobeNodesRef.current.forEach(({ mesh, baseColor }) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 0.005);
          mat.color.copy(baseColor).lerp(new THREE.Color(0xf2a20d), pulse * 0.35);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [buildGraphScene, filteredNodes]);

  // Update scene when nodes or edges change
  React.useEffect(() => {
    if (sceneRef.current) {
      buildGraphScene(sceneRef.current);
    }
  }, [buildGraphScene]);

  // Raycaster for Pointer Hover and Click Node Selection
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);

    for (const hit of intersects) {
      let curr: THREE.Object3D | null = hit.object;
      while (curr && !curr.userData?.isNode) {
        curr = curr.parent;
      }
      if (curr && curr.userData?.id) {
        const nodeId = curr.userData.id as string;
        workspaceStore.setSelectedNodeId(nodeId);
        onSelectNode?.(nodeId);
        return;
      }
    }
  };

  const handleResetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 140, 340);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const handleZoom = (delta: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const dir = new THREE.Vector3();
    cameraRef.current.getWorldDirection(dir);
    cameraRef.current.position.addScaledVector(dir, delta);
    controlsRef.current.update();
  };

  const handleFilterSelect = (newFilter: CanvasViewFilter) => {
    setActiveFilter(newFilter);
    onFilterChange?.(newFilter);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[420px] bg-zinc-950 overflow-hidden select-none ${className}`}
    >
      {/* Three.js Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="block w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
      />

      {/* Floating Canvas Top Controls Header */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Left: View Filter Tabs */}
        {!hideFilterControls && (
          <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/90 p-1 backdrop-blur-md pointer-events-auto top-shade shadow-lg">
            <Button
              variant={activeFilter === "all" ? "primary" : "ghost"}
              size="sm"
              onClick={() => handleFilterSelect("all")}
              className="h-7 px-2.5 text-xs text-zinc-300 hover:text-white"
            >
              All Nodes ({effectiveNodes.length})
            </Button>
            <Button
              variant={activeFilter === "funded" ? "primary" : "ghost"}
              size="sm"
              onClick={() => handleFilterSelect("funded")}
              className="h-7 px-2.5 text-xs flex items-center gap-1.5 text-zinc-300 hover:text-white"
            >
              <ShieldCheck className="h-3 w-3 text-blue-400" />
              Funded
            </Button>
            <Button
              variant={activeFilter === "unfunded" ? "primary" : "ghost"}
              size="sm"
              onClick={() => handleFilterSelect("unfunded")}
              className="h-7 px-2.5 text-xs flex items-center gap-1.5 text-zinc-400 hover:text-white"
            >
              <Link2 className="h-3 w-3 text-zinc-500" />
              Unfunded
            </Button>
          </div>
        )}

        {/* Right: Camera & View Mode Toggles */}
        <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/90 p-1 backdrop-blur-md pointer-events-auto top-shade shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom(40)}
            title="Zoom In"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom(-40)}
            title="Zoom Out"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <div className="h-4 w-[1px] bg-white/10 mx-0.5" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetCamera}
            title="Reset Camera View"
            className="h-7 px-2 text-xs text-zinc-400 hover:text-white"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          {hideViewToggle ? null : (
            <>
              <div className="h-4 w-[1px] bg-white/10 mx-0.5" />
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleViewMode}
                title="Switch to Accessible Keyboard List View"
                className="h-7 px-2.5 text-xs text-zinc-200 border-zinc-700 hover:bg-zinc-800"
              >
                <List className="h-3 w-3 mr-1.5 text-blue-400" />
                List View
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Floating Canvas Bottom Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-[11px] backdrop-blur-sm pointer-events-auto text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-blue-500 inline-block" />
          <span className="text-zinc-200 font-medium">Solid Line:</span> Authorized Delegation
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-b border-dashed border-zinc-500 inline-block" />
          <span className="text-zinc-200 font-medium">Dashed Line:</span> Structural Attachment
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span>Drag: Orbit · Right-click: Pan · Scroll: Zoom</span>
        </div>
      </div>
    </div>
  );
}
