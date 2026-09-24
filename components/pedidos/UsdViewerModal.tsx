"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { USDZLoader } from "three-usdz-loader";

interface Props {
  /** Rota de download já existente do anexo (mesma usada pelo link/QR/compartilhamento) —
   * o visualizador reutiliza esse mesmo arquivo, nunca cria uma segunda cópia. */
  downloadUrl: string;
  filename: string;
  onClose: () => void;
}

type Status = "downloading" | "processing" | "ready" | "error";

type ViewPreset = "front" | "back" | "left" | "right" | "top" | "bottom";

const VIEW_PRESET_LABELS: Record<ViewPreset, string> = {
  front: "Frontal",
  back: "Traseira",
  left: "Esquerda",
  right: "Direita",
  top: "Superior",
  bottom: "Inferior",
};

// Pequeno épsilon no eixo secundário de topo/baixo evita gimbal lock no lookAt
// (câmera olhando exatamente ao longo do eixo "up" perde a referência de rotação).
const VIEW_PRESET_DIRECTIONS: Record<ViewPreset, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 1, 0.0001),
  bottom: new THREE.Vector3(0, -1, 0.0001),
};

const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(1, 0.6, 1);

const BACKGROUND_COLORS = {
  light: 0xf1f5f9, // slate-100
  dark: 0x111111, // brand
};

// O USDZLoader injeta um <script> global e carrega ~9MB de WASM na primeira vez.
// Mantemos uma única instância pro processo do navegador inteiro para não repetir
// esse carregamento a cada vez que o usuário abre/fecha o visualizador.
let sharedLoader: USDZLoader | null = null;
function getSharedLoader(): USDZLoader {
  if (!sharedLoader) {
    sharedLoader = new USDZLoader("/usd-wasm");
  }
  return sharedLoader;
}

/** Baixa o arquivo acompanhando o progresso via Content-Length, quando disponível. */
async function fetchWithProgress(url: string, onProgress: (pct: number) => void): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Não foi possível baixar o arquivo (HTTP ${res.status}).`);
  }

  const total = Number(res.headers.get("Content-Length") ?? 0);
  if (!res.body || !total) {
    return res.blob();
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(99, Math.round((received / total) * 100)));
    }
  }

  return new Blob(chunks as BlobPart[]);
}

/** Enquadra a câmera no modelo carregado, olhando a partir de `direction`. */
function frameModel(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  group: THREE.Group,
  direction: THREE.Vector3 = DEFAULT_VIEW_DIRECTION
) {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.001);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (radius / Math.sin(fov / 2)) * 1.15;

  camera.position.copy(center.clone().add(direction.clone().normalize().multiplyScalar(distance)));
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

export default function UsdViewerModal({ downloadUrl, filename, onClose }: Props) {
  const viewerRegionRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  const [status, setStatus] = useState<Status>("downloading");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [background, setBackground] = useState<"light" | "dark">("light");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fecha com ESC e trava o scroll do body, igual ao componente Modal genérico.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(document.fullscreenElement === viewerRegionRef.current);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let usdInstance: Awaited<ReturnType<USDZLoader["loadFile"]>> | null = null;
    const clock = new THREE.Clock();

    async function run() {
      try {
        setStatus("downloading");
        setProgress(0);

        const blob = await fetchWithProgress(downloadUrl, (pct) => {
          if (!cancelled) setProgress(pct);
        });

        if (cancelled) return;

        const container = canvasContainerRef.current;
        if (!container) return;

        setStatus("processing");

        const file = new File([blob], filename, { type: "model/vnd.usdz+zip" });

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(BACKGROUND_COLORS[background]);

        const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 5000);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(5, 10, 7);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-5, -3, -5);
        scene.add(fillLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        // Toque: 1 dedo gira, pinça faz zoom+pan — padrão do OrbitControls já cobre isso.

        const group = new THREE.Group();
        scene.add(group);

        const loader = getSharedLoader();
        usdInstance = await loader.loadFile(file, group);

        if (cancelled) {
          usdInstance.clear();
          renderer.dispose();
          return;
        }

        frameModel(camera, controls, group);

        sceneRef.current = scene;
        cameraRef.current = camera;
        controlsRef.current = controls;
        groupRef.current = group;

        setStatus("ready");

        function animate() {
          animationFrameId = requestAnimationFrame(animate);
          controls.update();
          usdInstance?.update(clock.getElapsedTime());
          if (renderer) renderer.render(scene, camera);
        }
        animate();

        resizeObserver = new ResizeObserver(() => {
          if (!renderer) return;
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (w === 0 || h === 0) return;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        });
        resizeObserver.observe(container);
      } catch (err) {
        console.error("Erro ao carregar modelo 3D:", err);
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido ao carregar o modelo.");
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      controlsRef.current?.dispose();
      usdInstance?.clear();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      groupRef.current = null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, [downloadUrl, filename]);

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(BACKGROUND_COLORS[background]);
    }
  }, [background]);

  function handleReset() {
    if (!cameraRef.current || !controlsRef.current || !groupRef.current) return;
    frameModel(cameraRef.current, controlsRef.current, groupRef.current);
  }

  function handleViewPreset(preset: ViewPreset) {
    if (!cameraRef.current || !controlsRef.current || !groupRef.current) return;
    frameModel(cameraRef.current, controlsRef.current, groupRef.current, VIEW_PRESET_DIRECTIONS[preset]);
  }

  function handleToggleFullscreen() {
    const el = viewerRegionRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      el.requestFullscreen?.().catch(() => undefined);
    }
  }

  const isBusy = status === "downloading" || status === "processing";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-800">Visualizador 3D IMETAL</h2>
            <p className="truncate text-xs text-slate-400" title={filename}>
              {filename}
            </p>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div
          ref={viewerRegionRef}
          className={`relative flex-1 ${background === "dark" ? "bg-[#111111]" : "bg-slate-100"}`}
        >
          <div ref={canvasContainerRef} className="absolute inset-0" />

          {isBusy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm">
              <p className="text-sm font-medium text-slate-600">
                {status === "downloading" ? `Carregando modelo 3D... ${progress}%` : "Carregando modelo 3D..."}
              </p>
              <div className="h-1.5 w-56 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-brand transition-all duration-200"
                  style={{ width: `${status === "downloading" ? progress : 100}%` }}
                />
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-6 text-center">
              <p className="text-sm font-medium text-red-600">Não foi possível carregar este modelo 3D.</p>
              {errorMessage && <p className="max-w-sm text-xs text-slate-400">{errorMessage}</p>}
              <a
                href={downloadUrl}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light"
              >
                Baixar arquivo USDZ
              </a>
            </div>
          )}

          {status === "ready" && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div className="flex flex-wrap items-center justify-center gap-1 rounded-xl bg-brand/90 px-2 py-1.5 shadow-lg backdrop-blur">
                <button
                  onClick={handleReset}
                  className="rounded-md px-2 py-1 text-xs font-medium text-white hover:bg-white/10"
                  title="Resetar câmera / ajustar modelo à tela"
                >
                  Resetar / Ajustar
                </button>

                <select
                  defaultValue=""
                  onChange={(e) => {
                    const value = e.target.value as ViewPreset | "";
                    if (value) handleViewPreset(value);
                    e.target.value = "";
                  }}
                  className="rounded-md bg-transparent px-2 py-1 text-xs font-medium text-white hover:bg-white/10 [&>option]:text-slate-800"
                  title="Vistas predefinidas"
                >
                  <option value="" disabled>
                    Vista
                  </option>
                  {(Object.keys(VIEW_PRESET_LABELS) as ViewPreset[]).map((preset) => (
                    <option key={preset} value={preset}>
                      {VIEW_PRESET_LABELS[preset]}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setBackground((prev) => (prev === "light" ? "dark" : "light"))}
                  className="rounded-md px-2 py-1 text-xs font-medium text-white hover:bg-white/10"
                  title="Alternar fundo claro/escuro"
                >
                  Fundo {background === "light" ? "escuro" : "claro"}
                </button>

                <button
                  onClick={handleToggleFullscreen}
                  className="rounded-md px-2 py-1 text-xs font-medium text-white hover:bg-white/10"
                  title="Tela cheia"
                >
                  {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                </button>

                <a
                  href={downloadUrl}
                  className="rounded-md px-2 py-1 text-xs font-medium text-brand-accent hover:bg-white/10"
                  title="Baixar arquivo USDZ original"
                >
                  Baixar USDZ
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
