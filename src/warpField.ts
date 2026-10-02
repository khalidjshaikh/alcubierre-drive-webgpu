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
 */

export interface WarpParams {
  velocity: number;
  bubbleRadius: number;
  sigma: number;
  amplitude: number;
}

export const warpUniforms = [
  "worldViewProjection",
  "velocity",
  "bubbleX",
  "bubbleRadius",
  "sigma",
  "amplitude",
] as const;

export const warpVertexWGSL = /* wgsl */ `
attribute position : vec3<f32>;

uniform worldViewProjection : mat4x4<f32>;
uniform velocity : f32;
uniform bubbleX : f32;
uniform bubbleRadius : f32;
uniform sigma : f32;
uniform amplitude : f32;

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
  vertexOutputs.vGrid = p.xz;
}
`;

export const warpFragmentWGSL = /* wgsl */ `
varying vWarp : f32;
varying vRadial : f32;
varying vGrid : vec2<f32>;

fn gridLine(coord : f32, spacing : f32) -> f32 {
  let c = coord / spacing;
  let d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
  return 1.0 - clamp(d, 0.0, 1.0);
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

  // faint secondary grid, brighter primary lines
  let g = max(gridLine(input.vGrid.x, 1.0), gridLine(input.vGrid.y, 1.0));
  let major = max(gridLine(input.vGrid.x, 5.0), gridLine(input.vGrid.y, 5.0));

  let base = 0.10;
  let lineAlpha = g * 0.55 + major * 0.45;
  let alpha = clamp(base + lineAlpha * 0.55 + wall * 0.25, 0.0, 1.0);

  let emissive = col * (0.5 + g * 0.85 + wall * 0.5);
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
  vGrid = position.xz;
}
`;

export const warpFragmentGLSL = /* glsl */ `
precision highp float;

varying float vWarp;
varying float vRadial;
varying vec2 vGrid;

float gridLine(float coord, float spacing) {
  float c = coord / spacing;
  float d = abs(fract(c - 0.5) - 0.5) / fwidth(c);
  return 1.0 - clamp(d, 0.0, 1.0);
}

void main() {
  float t = clamp(vWarp * 7.0, -1.0, 1.0);
  vec3 cold = vec3(0.16, 0.62, 1.0);
  vec3 hot = vec3(1.0, 0.28, 0.10);

  vec3 col = mix(hot, cold, (t + 1.0) * 0.5);

  float wall = exp(-pow((vRadial - 0.55) * 6.0, 2.0));
  col += vec3(0.22, 0.16, 0.55) * wall;

  float g = max(gridLine(vGrid.x, 1.0), gridLine(vGrid.y, 1.0));
  float major = max(gridLine(vGrid.x, 5.0), gridLine(vGrid.y, 5.0));

  float base = 0.10;
  float lineAlpha = g * 0.55 + major * 0.45;
  float alpha = clamp(base + lineAlpha * 0.55 + wall * 0.25, 0.0, 1.0);

  vec3 emissive = col * (0.5 + g * 0.85 + wall * 0.5);
  gl_FragColor = vec4(emissive, alpha);
}
`;
