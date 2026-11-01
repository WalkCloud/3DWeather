// World-space banks cover the hill, meadow and both sides during a full orbit.
// The first two slots also cover the rear hill during light rain.
export const CLOUD_BANKS = {
  stratus: [
    {
      at: [0, 9.8, -3.8],
      width: 11.2,
      height: 3.2,
      depth: 8.0,
      opacity: 1,
      rotation: 0,
    },
    {
      at: [0.2, 9.5, 2.4],
      width: 8.4,
      height: 3.0,
      depth: 7.4,
      opacity: 0.97,
      rotation: 0,
    },
    {
      at: [-4.0, 9.7, -0.5],
      width: 6.4,
      height: 2.8,
      depth: 7.0,
      opacity: 0.93,
      rotation: -0.08,
    },
    {
      at: [4.0, 9.8, 0.6],
      width: 6.4,
      height: 2.9,
      depth: 7.0,
      opacity: 0.94,
      rotation: 0.08,
    },
  ],
  rain: [
    {
      at: [0, 9.6, -3.8],
      width: 11.2,
      height: 2.6,
      depth: 8.0,
      opacity: 1,
      rotation: 0,
    },
    {
      at: [0.3, 9.4, 2.4],
      width: 8.4,
      height: 2.7,
      depth: 7.4,
      opacity: 0.98,
      rotation: 0,
    },
    {
      at: [-4.0, 9.5, -0.4],
      width: 6.4,
      height: 2.7,
      depth: 7.0,
      opacity: 0.96,
      rotation: -0.06,
    },
    {
      at: [4.0, 9.6, 0.6],
      width: 6.4,
      height: 2.8,
      depth: 7.0,
      opacity: 0.97,
      rotation: 0.06,
    },
  ],
};

export function leafPose(leaf, elapsed) {
  const cycle =
    (((elapsed + leaf.phase) % (leaf.flight + leaf.rest + leaf.wait)) +
      leaf.flight +
      leaf.rest +
      leaf.wait) %
    (leaf.flight + leaf.rest + leaf.wait);
  if (cycle >= leaf.flight + leaf.rest)
    return { position: leaf.start, alpha: 0, landed: false, t: 0 };
  const t = Math.min(1, cycle / leaf.flight),
    flutter = Math.sin(Math.PI * t);
  const position = [
    leaf.start[0] +
      (leaf.end[0] - leaf.start[0]) * t +
      Math.sin(t * 11 + leaf.phase) * leaf.sway * flutter,
    leaf.start[1] + (leaf.end[1] - leaf.start[1]) * t,
    leaf.start[2] +
      (leaf.end[2] - leaf.start[2]) * t +
      Math.cos(t * 9 + leaf.phase) * leaf.sway * 0.65 * flutter,
  ];
  const landed = t === 1;
  const alpha = landed
    ? Math.min(1, (leaf.flight + leaf.rest - cycle) / 0.65)
    : Math.min(1, cycle / 0.14);
  return { position, alpha, landed, t };
}

export function sampleTerrainHeight(data, x, z, fallback = 0.7) {
  if (!data) return fallback;
  const n = data.size,
    u = (x / 18 + 0.5) * (n - 1),
    v = (z / 15 + 0.5) * (n - 1);
  if (u < 0 || v < 0 || u >= n - 1 || v >= n - 1) return -0.1;
  const ix = Math.floor(u),
    iz = Math.floor(v),
    fx = u - ix,
    fz = v - iz,
    h = data.heights;
  const a = h[iz * n + ix],
    b = h[iz * n + ix + 1],
    c = h[(iz + 1) * n + ix],
    d = h[(iz + 1) * n + ix + 1];
  if (a == null || b == null || c == null || d == null) return -0.1;
  return (
    ((a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz) * 18
  );
}

const pulse = (time, start, duration) => {
  const t = (time - start) / duration;
  return t >= 0 && t < 1 ? Math.pow(Math.sin(Math.PI * t), 0.4) : 0;
};

export function stormPulse(time) {
  const id = Math.floor(Math.max(0, time) / 7.6);
  const offset = 0.6 + ((id * 137.31 + 0.24) % 1) * 1.5;
  const local = time - id * 7.6 - offset;
  return {
    id,
    local,
    flash: Math.max(
      pulse(local, 0, 0.16) * 0.8,
      pulse(local, 0.24, 0.32),
      pulse(local, 0.66, 0.17) * 0.5,
    ),
    cloud: Math.max(
      pulse(local, -0.12, 0.3) * 0.55,
      pulse(local, 0.22, 0.4),
      pulse(local, 0.64, 0.23) * 0.5,
    ),
  };
}
