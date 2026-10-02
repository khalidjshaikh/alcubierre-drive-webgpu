import type { WarpParams } from "./warpField";

export interface Toggles {
  grid: boolean;
  bubble: boolean;
  stars: boolean;
  paused: boolean;
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`UI element #${id} not found`);
  return found as T;
}

function bindRange(
  id: string,
  params: WarpParams,
  key: keyof WarpParams,
  digits: number,
): void {
  const input = el<HTMLInputElement>(id);
  const out = el<HTMLOutputElement>(`${id}-out`);
  const render = () => (out.textContent = Number(params[key]).toFixed(digits));
  input.value = String(params[key]);
  render();
  input.addEventListener("input", () => {
    params[key] = Number(input.value);
    render();
  });
}

export function setupUi(params: WarpParams, toggles: Toggles, onChange: () => void): void {
  bindRange("velocity", params, "velocity", 2);
  bindRange("radius", params, "bubbleRadius", 2);
  bindRange("sigma", params, "sigma", 2);
  bindRange("amplitude", params, "amplitude", 2);

  const bindToggle = (id: string, key: keyof Toggles) => {
    const input = el<HTMLInputElement>(id);
    input.checked = toggles[key];
    input.addEventListener("change", () => {
      toggles[key] = input.checked;
      onChange();
    });
  };
  bindToggle("t-grid", "grid");
  bindToggle("t-bubble", "bubble");
  bindToggle("t-stars", "stars");
  bindToggle("t-paused", "paused");
}
