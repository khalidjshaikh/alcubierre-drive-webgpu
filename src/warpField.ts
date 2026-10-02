/**
 * Alcubierre warp-field shader source (WGSL + GLSL fallback).
 *
 * The Alcubierre metric describes a "bubble" of flat space that translates
 * faster than light while passengers remain in free fall:
 *
 *   ds² = -dt² + (dx − vₛ·f(rₛ)·dt)² + dy² + dz²
 *
 * with the shape function
 *
 *   f(r) = [tanh(σ(r+R)) − tanh(σ(r−R))] / (2·tanh(σR))
 *
 * The rate at which space itself is stretched/compressed is the expansion
 * scalar of the Eulerian observers (York time):
 *
 *   θ = ∇·v = vₛ · (xₛ/rₛ) · f'(rₛ)
 *
 * θ < 0 ahead of the bubble (space contracts → negative energy density),
 * θ > 0 behind it (space expands → ordinary matter).  The grid below is
 * displaced vertically by θ and tinted red (contraction) / blue (expansion).
 *
 * The visible squares track the real tessellation: `cellSize` is the world
 * spacing of the mesh vertices, so lowering the resolution coarsens both the
 * triangle mesh and the drawn grid, exposing how the equation is sampled.
 */

export interface WarpParams {
  velocity: number;
  bubbleRadius: number;
  sigma: number;
  amplitude: number;
  resolution: number;
}

export const warpUniforms = [
  "worldViewProjection",
  "velocity",
  "bubbleX",
  "bubbleRadius",
  "sigma",
  "amplitude",
  "gridOriginX",
  "cellSize",
] as const;

export const warpVertexWGSL = /* wgsl */ `
attribute position : vec3<f32>;

uniform worldViewProjection : mat4x4<f32>;
uniform velocity : f32;
uniform bubbleX : f32;
uniform bubbleRadius : f32;
uniform sigma : f32;
uniform amplitude : f32;
uniform gridOriginX : f32;

varying vWarp : f32;
varying vRadial : f32;
varying vGrid : vec2<f32>;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let p = vertexInputs.position;
  let dx = p.x - uniforms.bubbleX;
  let r = sqrt(dx * dx + p.z * p.z + 1e-4);
  let R = uniforms.bubbleRadius;
  let s = uniforms.sigma;

  let denom = 2.0 * tanh(s * R);
  let t1 = tanh(s * (r + R));
  let t2 = tanh(s * (r - R));

  // shape function f(r) and its radial derivative f'(r)
  let f = (t1 - t2) / denom;
  let dfdr = s * ((1.0 - t1 * t1) - (1.0 - t2 * t2)) / denom;

  // expansion scalar theta (odd in x: contract ahead, expand behind)
  let theta = uniforms.velocity * (dx / r) * dfdr;

  let y = -uniforms.amplitude * tanh(theta * 9.0);

  vertexOutputs.position = uniforms.worldViewProjection * vec4<f32>(p.x, y, p.z, 1.0);
  vertexOutputs.vWarp = theta;
  vertexOutputs.vRadial = f;
  // world-space coordinates so the grid pattern stays put as the mesh snaps
  vertexOutputs.vGrid = p.xz + vec2<f32>(uniforms.gridOriginX, 0.0);
}
`;

export const warpFragmentWGSL = /* wgsl */ `
uniform cellSize : f32;

varying vWarp : f32;
varying vRadial : f32;
varying vGrid : vec2<f32>;

fn gridLine(coord : f32, spacing : f32) -> f32 {
  let fw = fwidth(coord);
  let fade = clamp(spacing / (2.0 * fw + 1e-5), 0.0, 1.0);
  let c = coord / spacing;
  let d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
  return (1.0 - clamp(d, 0.0, 1.0)) * fade;
}

fn diagLine(coord : vec2<f32>, spacing : f32) -> f32 {
  let fwx = fwidth(coord.x);
  let fwy = fwidth(coord.y);
  let fade = clamp(spacing / (2.0 * max(fwx, fwy) + 1e-5), 0.0, 1.0);
  let cell = coord / spacing;
  let d = abs(fract(cell.x) - fract(cell.y)) / (0.5 * (fwidth(cell.x) + fwidth(cell.y)) + 1e-5);
  return (1.0 - clamp(d, 0.0, 1.0)) * fade;
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let t = clamp(input.vWarp * 7.0, -1.0, 1.0);
  let cold = vec3<f32>(0.16, 0.62, 1.0);
  let hot  = vec3<f32>(1.0, 0.28, 0.10);

  var col = mix(hot, cold, (t + 1.0) * 0.5);

  // bright membrane where the bubble wall sits
  let wall = exp(-pow((input.vRadial - 0.55) * 6.0, 2.0));
  col = col + vec3<f32>(0.22, 0.16, 0.55) * wall;

  let s = uniforms.cellSize;
  let g = max(gridLine(input.vGrid.x, s), gridLine(input.vGrid.y, s));
  let major = max(gridLine(input.vGrid.x, s * 5.0), gridLine(input.vGrid.y, s * 5.0));
  let diag = diagLine(input.vGrid, s);

  let lineAlpha = g * 0.5 + major * 0.35 + diag * 0.22;
  let alpha = clamp(0.10 + lineAlpha * 0.55 + wall * 0.25, 0.0, 1.0);

  let emissive = col * (0.42 + g * 0.8 + major * 0.45 + diag * 0.35 + wall * 0.5);
  fragmentOutputs.color = vec4<f32>(emissive, alpha);
}
`;

// ---------------------------------------------------------------------------
// GLSL fallback (used when WebGPU is unavailable and Babylon runs on WebGL2)
// ---------------------------------------------------------------------------

export const warpVertexGLSL = /* glsl */ `
precision highp float;

attribute vec3 position;

uniform mat4 worldViewProjection;
uniform float velocity;
uniform float bubbleX;
uniform float bubbleRadius;
uniform float sigma;
uniform float amplitude;
uniform float gridOriginX;

varying float vWarp;
varying float vRadial;
varying vec2 vGrid;

void main() {
  vec3 p = position;
  float dx = p.x - bubbleX;
  float r = sqrt(dx * dx + p.z * p.z + 1e-4);
  float R = bubbleRadius;
  float s = sigma;

  float denom = 2.0 * tanh(s * R);
  float t1 = tanh(s * (r + R));
  float t2 = tanh(s * (r - R));

  float f = (t1 - t2) / denom;
  float dfdr = s * ((1.0 - t1 * t1) - (1.0 - t2 * t2)) / denom;

  float theta = velocity * (dx / r) * dfdr;
  p.y = -amplitude * tanh(theta * 9.0);

  gl_Position = worldViewProjection * vec4(p, 1.0);
  vWarp = theta;
  vRadial = f;
  vGrid = position.xz + vec2(gridOriginX, 0.0);
}
`;

export const warpFragmentGLSL = /* glsl */ `
precision highp float;

uniform float cellSize;

varying float vWarp;
varying float vRadial;
varying vec2 vGrid;

float gridLine(float coord, float spacing) {
  float fw = fwidth(coord);
  float fade = clamp(spacing / (2.0 * fw + 1e-5), 0.0, 1.0);
  float c = coord / spacing;
  float d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
  return (1.0 - clamp(d, 0.0, 1.0)) * fade;
}

float diagLine(vec2 coord, float spacing) {
  float fwx = fwidth(coord.x);
  float fwy = fwidth(coord.y);
  float fade = clamp(spacing / (2.0 * max(fwx, fwy) + 1e-5), 0.0, 1.0);
  vec2 cell = coord / spacing;
  float d = abs(fract(cell.x) - fract(cell.y)) / (0.5 * (fwidth(cell.x) + fwidth(cell.y)) + 1e-5);
  return (1.0 - clamp(d, 0.0, 1.0)) * fade;
}

void main() {
  float t = clamp(vWarp * 7.0, -1.0, 1.0);
  vec3 cold = vec3(0.16, 0.62, 1.0);
  vec3 hot = vec3(1.0, 0.28, 0.10);

  vec3 col = mix(hot, cold, (t + 1.0) * 0.5);

  float wall = exp(-pow((vRadial - 0.55) * 6.0, 2.0));
  col += vec3(0.22, 0.16, 0.55) * wall;

  float s = cellSize;
  float g = max(gridLine(vGrid.x, s), gridLine(vGrid.y, s));
  float major = max(gridLine(vGrid.x, s * 5.0), gridLine(vGrid.y, s * 5.0));
  float diag = diagLine(vGrid, s);

  float lineAlpha = g * 0.5 + major * 0.35 + diag * 0.22;
  float alpha = clamp(0.10 + lineAlpha * 0.55 + wall * 0.25, 0.0, 1.0);

  vec3 emissive = col * (0.42 + g * 0.8 + major * 0.45 + diag * 0.35 + wall * 0.5);
  gl_FragColor = vec4(emissive, alpha);
}
`;
