import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { FresnelParameters } from "@babylonjs/core/Materials/fresnelParameters";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { WarpParams } from "./warpField";

const BUBBLE_Y = 1.35;

export class WarpShip {
  readonly root: TransformNode;
  private readonly bubble: ReturnType<typeof CreateSphere>;
  private readonly bubbleMat: StandardMaterial;

  constructor(scene: Scene) {
    this.root = new TransformNode("warpShip", scene);
    this.root.position = new Vector3(0, BUBBLE_Y, 0);

    // --- the ship ---------------------------------------------------------
    const hull = new StandardMaterial("hullMat", scene);
    hull.diffuseColor = new Color3(0.72, 0.76, 0.85);
    hull.specularColor = new Color3(0.9, 0.95, 1.0);
    hull.emissiveColor = new Color3(0.06, 0.12, 0.25);

    const body = CreateCylinder(
      "hull",
      { height: 2.4, diameterTop: 0.34, diameterBottom: 0.62, tessellation: 24 },
      scene,
    );
    body.material = hull;
    body.rotation.z = Math.PI / 2;
    body.parent = this.root;
    body.position = new Vector3(0.1, 0, 0);

    const nose = CreateSphere("nose", { diameter: 0.4, segments: 16 }, scene);
    nose.material = hull;
    nose.parent = this.root;
    nose.position = new Vector3(1.35, 0, 0);
    nose.scaling = new Vector3(1.6, 1, 1);

    const wingMat = new StandardMaterial("wingMat", scene);
    wingMat.diffuseColor = new Color3(0.18, 0.32, 0.62);
    wingMat.emissiveColor = new Color3(0.05, 0.25, 0.55);
    wingMat.specularColor = new Color3(0.4, 0.6, 1.0);

    for (const side of [-1, 1]) {
      const wing = CreateBox("wing", { width: 0.7, height: 0.09, depth: 1.7 }, scene);
      wing.material = wingMat;
      wing.parent = this.root;
      wing.position = new Vector3(-0.55, 0, side * 0.72);
      wing.rotation.x = side * 0.18;
      wing.rotation.z = -0.12;
    }

    // --- the warp bubble --------------------------------------------------
    this.bubbleMat = new StandardMaterial("bubbleMat", scene);
    this.bubbleMat.diffuseColor = new Color3(0.06, 0.16, 0.4);
    this.bubbleMat.emissiveColor = new Color3(0.03, 0.1, 0.26);
    this.bubbleMat.specularColor = Color3.Black();
    this.bubbleMat.alpha = 0.14;
    this.bubbleMat.backFaceCulling = false;
    this.bubbleMat.disableLighting = true;
    this.bubbleMat.emissiveFresnelParameters = new FresnelParameters();
    this.bubbleMat.emissiveFresnelParameters.bias = 0.5;
    this.bubbleMat.emissiveFresnelParameters.power = 2.6;
    this.bubbleMat.emissiveFresnelParameters.leftColor = new Color3(0.9, 0.45, 0.2);
    this.bubbleMat.emissiveFresnelParameters.rightColor = new Color3(0.25, 0.65, 1.0);

    this.bubble = CreateSphere("bubble", { diameter: 2, segments: 48 }, scene);
    this.bubble.material = this.bubbleMat;
    this.bubble.isPickable = false;
    this.bubble.parent = this.root;
  }

  setVisible(visible: boolean): void {
    this.root.setEnabled(visible);
  }

  update(bubbleWorldX: number, params: WarpParams): void {
    this.root.position.x = bubbleWorldX;
    const r = Math.max(params.bubbleRadius, 0.2);
    this.bubble.scaling.setAll(r);
    this.bubble.rotation.y += 0.0025;
  }
}
