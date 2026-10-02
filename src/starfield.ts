import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Color3 } from "@babylonjs/core/Maths/math.color";

const RANGE = 70; // half-length of the star stream along the travel axis
const SPREAD = 26; // lateral spread

export class Starfield {
  private readonly mesh: Mesh;
  private readonly node: TransformNode;
  private readonly positions: Float32Array;
  private readonly matrices: Float32Array;
  private readonly count: number;

  constructor(scene: Scene, count = 1500) {
    this.count = count;

    const source = CreateSphere("star", { diameter: 0.17, segments: 5 }, scene);
    const mat = new StandardMaterial("starMat", scene);
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(0.85, 0.92, 1.0);
    mat.specularColor = Color3.Black();
    mat.fogEnabled = false;
    source.material = mat;
    source.isPickable = false;
    this.mesh = source;

    this.positions = new Float32Array(count * 3);
    this.matrices = new Float32Array(count * 16);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * 2 * RANGE - RANGE;
      const y = Math.random() * 2 * SPREAD - SPREAD;
      const z = Math.random() * 2 * SPREAD - SPREAD;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;

      const s = 0.4 + Math.random() * 1.5;
      const m = i * 16;
      this.matrices[m] = s;
      this.matrices[m + 5] = s;
      this.matrices[m + 10] = s;
      this.matrices[m + 15] = 1;
      this.matrices[m + 12] = x;
      this.matrices[m + 13] = y;
      this.matrices[m + 14] = z;
    }

    source.thinInstanceSetBuffer("matrix", this.matrices, 16, false);

    this.node = new TransformNode("starStream", scene);
    source.parent = this.node;
  }

  setVisible(visible: boolean): void {
    this.node.setEnabled(visible);
  }

  update(dt: number, velocity: number, shipX: number): void {
    this.node.position.x = shipX;
    const travel = velocity * dt;
    if (travel === 0) return;

    const p = this.positions;
    const m = this.matrices;
    for (let i = 0; i < this.count; i++) {
      const xi = i * 3;
      p[xi] -= travel;
      if (p[xi] < -RANGE) {
        p[xi] += 2 * RANGE;
        p[xi + 1] = Math.random() * 2 * SPREAD - SPREAD;
        p[xi + 2] = Math.random() * 2 * SPREAD - SPREAD;
      }
      const mi = i * 16;
      m[mi + 12] = p[xi];
      m[mi + 13] = p[xi + 1];
      m[mi + 14] = p[xi + 2];
    }
    this.mesh.thinInstanceBufferUpdated("matrix");
  }
}
