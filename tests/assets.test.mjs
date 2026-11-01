import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function glb(name) {
  const bytes = await readFile(
    new URL(`../public/assets/models/${name}.glb`, import.meta.url),
  );
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
}

test("every runtime asset is a complete embedded GLB", async () => {
  for (const name of [
    "cottage",
    "terrain",
    "cow",
    "sheep",
    "horse",
    "fish",
    "autumn-leaf",
  ]) {
    const data = await glb(name);
    assert.ok(data.meshes.length > 0, name);
    for (const image of data.images ?? [])
      assert.ok(image.bufferView !== undefined, `${name}: embedded textures`);
  }
});

test("cloud density assets have soft boundaries, empty space and distinct weather anatomy", async () => {
  const base = new URL("../public/assets/clouds/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", base), "utf8"),
  );
  const [width, height, depth] = manifest.dimensions;
  const fields = {};
  for (const [name, field] of Object.entries(manifest.fields)) {
    const data = await readFile(new URL(field.file, base));
    fields[name] = data;
    assert.equal(
      data.length,
      width * height * depth,
      `${name}: complete volume`,
    );
    let empty = 0,
      feathered = 0,
      dense = 0;
    for (let z = 0; z < depth; z++)
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const value = data[x + width * (y + height * z)];
          if (
            x === 0 ||
            y === 0 ||
            z === 0 ||
            x === width - 1 ||
            y === height - 1 ||
            z === depth - 1
          )
            assert.equal(value, 0, `${name}: no visible box boundary`);
          if (value === 0) empty++;
          else if (value < 128) feathered++;
          else dense++;
        }
    assert.ok(empty > data.length * 0.5, `${name}: clear sky surrounds cloud`);
    assert.ok(
      feathered > (feathered + dense) * 0.15,
      `${name}: translucent perimeter`,
    );
    assert.ok(dense > data.length * 0.02, `${name}: coherent dense core`);
    assert.ok(
      field.precipitationBases.length >= 64,
      `${name}: precipitation origins`,
    );
    for (const [x, y, z] of field.precipitationBases) {
      const ix = Math.round((x + 0.5) * (width - 1));
      const iy = Math.round((y + 0.5) * (height - 1));
      const iz = Math.round((z + 0.5) * (depth - 1));
      assert.ok(
        data[ix + width * (iy + height * iz)] > 35,
        `${name}: origin touches cloud`,
      );
      for (let below = 0; below < iy; below++)
        assert.ok(
          data[ix + width * (below + height * iz)] <= 35,
          `${name}: origin is beneath dense cloud`,
        );
    }
  }
  assert.notDeepEqual(fields.stratus, fields.rain);
  assert.notDeepEqual(fields.stratus, fields.cumulus);
});

test("animals carry deforming skeletons and both clips; fish carries swim", async () => {
  for (const [name, clips] of [
    ["cow", ["Graze", "Walk"]],
    ["sheep", ["Graze", "Walk"]],
    ["horse", ["Graze", "Walk"]],
    ["fish", ["Swim"]],
  ]) {
    const data = await glb(name);
    assert.ok(data.skins?.length > 0, `${name}: skin`);
    for (const clip of clips) {
      const animation = data.animations.find((a) => a.name === clip);
      assert.ok(animation, `${name}: ${clip}`);
      assert.ok(animation.channels.some((c) => c.target.path === "rotation"));
      const duration = Math.max(
        ...animation.samplers.map((s) => data.accessors[s.input].max?.[0] ?? 0),
      );
      assert.ok(duration >= 1.9);
    }
  }
});
