import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";

import { WarpGrid } from "./warpGrid";
import { WarpShip } from "./ship";
import { Starfield } from "./starfield";
import { setupUi, type Toggles } from "./ui";
import type { WarpParams } from "./warpField";

const params: WarpParams = {
  velocity: 2.6,
  bubbleRadius: 2.4,
  sigma: 1.6,
  amplitude: 1.4,
};

const toggles: Toggles = {
  grid: true,
  bubble: true,
  stars: true,
  paused: false,
};

async function createEngine(canvas: HTMLCanvasElement): Promise<{ engine: AbstractEngine; webgpu: boolean }> {
  if (await WebGPUEngine.IsSupportedAsync) {
    try {
      const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await engine.initAsync();
      return { engine, webgpu: true };
    } catch (error) {
      console.warn("WebGPU init failed, falling back to WebGL2.", error);
    }
  }
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true }, true);
  return { engine, webgpu: false };
}

async function main(): Promise<void> {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const badge = document.getElementById("backend")!;

  const { engine, webgpu } = await createEngine(canvas);
  badge.textContent = webgpu ? "WebGPU active" : "WebGL2 fallback";
  badge.classList.toggle("bad", !webgpu);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.012, 0.017, 0.045, 1);
  scene.ambientColor = new Color3(0.1, 0.12, 0.2);

  const camera = new ArcRotateCamera("camera", -Math.PI / 2 - 0.85, 1.12, 14, new Vector3(0, 1.35, 0), scene);
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 60;
  camera.lowerBetaLimit = 0.12;
  camera.upperBetaLimit = Math.PI / 2 + 0.35;
  camera.wheelDeltaPercentage = 0.02;
  camera.attachControl(canvas, true);

  new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene).intensity = 0.7;
  const key = new DirectionalLight("key", new Vector3(-1, -0.8, -0.6), scene);
  key.position = new Vector3(20, 30, 20);
  key.intensity = 1.1;

  const glow = new GlowLayer("glow", scene, { blurKernelSize: 48 });
  glow.intensity = 0.7;

  const grid = new WarpGrid(scene, params, webgpu);
  const ship = new WarpShip(scene);
  const stars = new Starfield(scene);

  setupUi(params, toggles, () => {
    grid.setVisible(toggles.grid);
    ship.setVisible(toggles.bubble);
    stars.setVisible(toggles.stars);
  });

  let bubbleX = 0;

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    const step = toggles.paused ? 0 : dt;

    bubbleX += params.velocity * step;

    grid.update(bubbleX);
    ship.update(bubbleX, params);
    stars.update(step, params.velocity, bubbleX);

    camera.target.x += (bubbleX - camera.target.x) * Math.min(1, dt * 6);
    camera.target.y = 1.35;

    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());
}

main().catch((error) => {
  console.error(error);
  const badge = document.getElementById("backend");
  if (badge) {
    badge.textContent = "failed to start";
    badge.classList.add("bad");
  }
});
