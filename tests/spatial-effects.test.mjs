import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  CLOUD_BANKS,
  leafPose,
  sampleTerrainHeight,
  stormPulse,
} from "../src/spatial-effects.js";
import { RAIN_PROFILES } from "../src/rain.js";

const asset = (file) => new URL(`../public/assets/${file}`, import.meta.url);
const json = async (file) => JSON.parse(await readFile(asset(file), "utf8"));

test("autumn sources belong to the six retained tree crowns, above bare ground", async () => {
  const [anchors, ground, terrain] = await Promise.all([
    json("tree-anchors.json"),
    json("terrain-ground-heights.json"),
    readFile(asset("models/terrain.glb")),
  ]);
  assert.equal(
    anchors.sourceSha256,
    createHash("sha256").update(terrain).digest("hex"),
  );
  assert.equal(anchors.trees.length, 6);
  for (const tree of anchors.trees) {
    assert.ok(
      tree.canopyCells >= 45,
      `${tree.id}: exclude small rim shrubs/stones`,
    );
    assert.ok(tree.emitters.length >= 16);
    for (const [x, y, z] of tree.emitters) {
      assert.ok(
        y >= tree.crownY[0] - 0.02 && y <= tree.crownY[1] + 0.02,
        `${tree.id}: starts on crown`,
      );
      assert.ok(
        y - sampleTerrainHeight(ground, x, z) > 0.75,
        `${tree.id}: canopy, not ground`,
      );
      assert.ok(
        Math.hypot(x - tree.center[0], z - tree.center[1]) < 1.7,
        `${tree.id}: local source`,
      );
    }
  }
});

test("leaves fall continuously to nearby ground, rest, then fade before respawning", () => {
  const leaf = {
    start: [1, 4, 2],
    end: [1.2, 0.9, 2.15],
    flight: 5,
    rest: 4,
    wait: 8,
    phase: 0,
    sway: 0.08,
  };
  let previous = leafPose(leaf, 0);
  for (let time = 0.05; time <= 5; time += 0.05) {
    const pose = leafPose(leaf, time);
    assert.ok(pose.position[1] <= previous.position[1] + 1e-9);
    assert.ok(Math.hypot(pose.position[0] - 1, pose.position[2] - 2) < 0.4);
    assert.ok(
      Math.hypot(...pose.position.map((v, i) => v - previous.position[i])) <
        0.06,
    );
    previous = pose;
  }
  const before = leafPose(leaf, 4.999),
    landed = leafPose(leaf, 5.001);
  assert.ok(
    Math.hypot(...landed.position.map((v, i) => v - before.position[i])) <
      0.002,
  );
  assert.ok(
    leafPose(leaf, 7).position.every(
      (v, i) => Math.abs(v - leaf.end[i]) < 1e-9,
    ),
  );
  assert.equal(leafPose(leaf, 7).landed, true);
  assert.ok(leafPose(leaf, 8.8).alpha < 0.4);
  assert.equal(leafPose(leaf, 10).alpha, 0);
  assert.equal(leafPose(leaf, 17).alpha, 0);
});

test("actual cloud density covers rear summit across all clouded rain grades", async () => {
  const [anchors, manifest] = await Promise.all([
    json("tree-anchors.json"),
    json("clouds/manifest.json"),
  ]);
  const [width, height, depth] = manifest.dimensions;
  for (const [role, field, scale] of [
    ["stratus", "stratus", 1],
    ...Object.values(RAIN_PROFILES).map((p) => [
      "rain",
      p.texture,
      p.widthScale,
    ]),
  ]) {
    const data = await readFile(asset(`clouds/${manifest.fields[field].file}`));
    // Front and back banks are present even in light rain. Check actual volume,
    // not just bounding boxes, including the full lateral drift envelope.
    for (const tree of anchors.trees.slice(0, 3))
      for (const drift of [-0.42, 0, 0.42]) {
        const maximum = Math.max(
          ...CLOUD_BANKS[role].slice(0, 2).map((bank) => {
            const dx = tree.center[0] - bank.at[0] - drift,
              dz = tree.center[1] - bank.at[2];
            const c = Math.cos(bank.rotation),
              s = Math.sin(bank.rotation);
            const ix = Math.round(
              ((dx * c - dz * s) / (bank.width * scale) + 0.5) * (width - 1),
            );
            const iz = Math.round(
              ((dx * s + dz * c) / (bank.depth * scale) + 0.5) * (depth - 1),
            );
            if (ix < 0 || ix >= width || iz < 0 || iz >= depth) return 0;
            let peak = 0;
            for (let y = 0; y < height; y++)
              peak = Math.max(peak, data[ix + width * (y + height * iz)]);
            return peak;
          }),
        );
        assert.ok(
          maximum > 60,
          `${field}: cloud over ${tree.id}, drift ${drift}`,
        );
      }
  }
});

test("storm illumination precedes visible lightning, with pulses separated by darkness", () => {
  const frames = Array.from({ length: 760 }, (_, i) => stormPulse(i / 100));
  const preglow = frames.findIndex((p) => p.cloud > 0.05);
  const firstBolt = frames.findIndex((p) => p.flash > 0.05);
  assert.ok(preglow >= 0 && preglow < firstBolt);
  const visible = frames.filter((p) => p.flash > 0.05);
  assert.ok(
    visible.length >= 50 && visible.length < 95,
    "readable but intermittent lightning",
  );
  let bursts = 0,
    lit = false;
  for (const p of frames) {
    const now = p.flash > 0.05;
    if (now && !lit) bursts++;
    lit = now;
  }
  assert.equal(bursts, 3);
  assert.ok(frames.slice(250).every((p) => p.flash === 0 && p.cloud === 0));
  assert.notEqual(stormPulse(0).id, stormPulse(8).id);
});

test("optional thunder audio is a finite, unclipped local waveform", async () => {
  const bytes = await readFile(asset("audio/thunder.wav"));
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  assert.equal(bytes.readUInt16LE(22), 1);
  assert.equal(bytes.readUInt32LE(24), 32000);
  assert.equal(bytes.readUInt16LE(34), 16);
  const samples = (bytes.length - 44) / 2;
  assert.ok(samples / 32000 > 5 && samples / 32000 < 6);
  let peak = 0;
  for (let i = 44; i < bytes.length; i += 2)
    peak = Math.max(peak, Math.abs(bytes.readInt16LE(i)));
  assert.ok(peak > 5000 && peak < 32767);
});
