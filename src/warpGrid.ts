import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import {
  type WarpParams,
  warpUniforms,
  warpVertexWGSL,
  warpFragmentWGSL,
  warpVertexGLSL,
  warpFragmentGLSL,
} from "./warpField";

const GRID_SIZE = 140;
const GRID_SEGMENTS = 200;
const SNAP = 5;

export class WarpGrid {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly params: WarpParams;

  constructor(scene: Scene, params: WarpParams, useWebGPU: boolean) {
    this.params = params;

    this.mesh = CreateGround(
      "warpGrid",
      { width: GRID_SIZE, height: GRID_SIZE, subdivisionsX: GRID_SEGMENTS, subdivisionsY: GRID_SEGMENTS },
      scene,
    );
    this.mesh.isPickable = false;

    this.material = new ShaderMaterial(
      "warpGridMat",
      scene,
      useWebGPU
        ? { vertexSource: warpVertexWGSL, fragmentSource: warpFragmentWGSL }
        : { vertexSource: warpVertexGLSL, fragmentSource: warpFragmentGLSL },
      {
        attributes: ["position"],
        uniforms: [...warpUniforms],
        shaderLanguage: useWebGPU ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
        needAlphaBlending: true,
      },
    );
    this.material.backFaceCulling = true;
    this.material.alphaMode = 2; // ALPHA_COMBINE
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
  }

  setVisible(visible: boolean): void {
    this.mesh.setEnabled(visible);
  }

  /** Advance the grid so it always spans the region around the bubble. */
  update(bubbleWorldX: number): void {
    const snapped = Math.round(bubbleWorldX / SNAP) * SNAP;
    this.mesh.position.x = snapped;

    const u = this.material;
    u.setFloat("velocity", this.params.velocity);
    u.setFloat("bubbleX", bubbleWorldX - snapped);
    u.setFloat("bubbleRadius", this.params.bubbleRadius);
    u.setFloat("sigma", this.params.sigma);
    u.setFloat("amplitude", this.params.amplitude);
  }
}
