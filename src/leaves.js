import * as THREE from "three";
import { leafPose } from "./spatial-effects.js";

export function createAutumnLeaves(scene, gltf, anchors, groundAt, random) {
  gltf.scene.updateMatrixWorld(true);
  let geometry;
  gltf.scene.traverse((object) => {
    if (object.isMesh && !geometry)
      geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
  });
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nattribute float aLeafAlpha; varying float vLeafAlpha;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvLeafAlpha=aLeafAlpha;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying float vLeafAlpha;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.a*=vLeafAlpha;if(diffuseColor.a<.02)discard;",
    );
  };
  const palette = [0xb85320, 0xd98a27, 0xc06d1c, 0xe0af43].map(
    (v) => new THREE.Color(v),
  );
  const seeds = [];
  for (const tree of anchors.trees)
    for (let i = 0; i < 5; i++) {
      const start = tree.emitters[Math.floor(random() * tree.emitters.length)];
      const dx = 0.12 + (random() - 0.5) * 0.36,
        dz = (random() - 0.5) * 0.4;
      seeds.push({
        tree: tree.id,
        start,
        end: [
          start[0] + dx,
          groundAt(start[0] + dx, start[2] + dz) + 0.035,
          start[2] + dz,
        ],
        flight: 4.2 + random() * 2.0,
        rest: 3 + random() * 3,
        wait: 5 + random() * 8,
        phase: random() * 23,
        sway: 0.04 + random() * 0.045,
        size: 0.095 + random() * 0.055,
        yaw: random() * Math.PI * 2,
      });
    }
  const fallingGeometry = geometry.clone();
  const alphas = new THREE.InstancedBufferAttribute(
    new Float32Array(seeds.length),
    1,
  );
  fallingGeometry.setAttribute("aLeafAlpha", alphas);
  const falling = new THREE.InstancedMesh(
    fallingGeometry,
    material,
    seeds.length,
  );
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  falling.frustumCulled = false;
  falling.name = "Leaves attached to real tree crowns";
  const pose = new THREE.Object3D();
  seeds.forEach((_s, i) => falling.setColorAt(i, palette[i % palette.length]));
  const groundCount = anchors.trees.length * 14;
  const groundGeometry = geometry.clone();
  groundGeometry.setAttribute(
    "aLeafAlpha",
    new THREE.InstancedBufferAttribute(
      new Float32Array(groundCount).fill(0.85),
      1,
    ),
  );
  const ground = new THREE.InstancedMesh(groundGeometry, material, groundCount);
  ground.name = "Leaf litter near real tree trunks";
  for (let i = 0; i < groundCount; i++) {
    const tree = anchors.trees[i % anchors.trees.length],
      a = random() * Math.PI * 2,
      r = 0.18 + random() * 0.78;
    const x = tree.center[0] + Math.cos(a) * r,
      z = tree.center[1] + Math.sin(a) * r;
    pose.position.set(x, groundAt(x, z) + 0.025, z);
    pose.rotation.set(0, random() * Math.PI * 2, 0);
    pose.scale.setScalar(0.085 + random() * 0.05);
    pose.updateMatrix();
    ground.setMatrixAt(i, pose.matrix);
    ground.setColorAt(i, palette[i % palette.length]);
  }
  scene.add(falling, ground);
  function update(time, visible, groundVisible = visible) {
    falling.visible = visible;
    ground.visible = groundVisible;
    if (!visible) return;
    for (let i = 0; i < seeds.length; i++) {
      const leaf = seeds[i],
        p = leafPose(leaf, time);
      pose.position.fromArray(p.position);
      pose.rotation.set(
        p.landed ? 0 : Math.sin(time * 2 + leaf.phase) * 0.85 * (1 - p.t),
        leaf.yaw + (p.landed ? 0 : time * 0.65),
        p.landed ? 0 : Math.cos(time * 1.7 + leaf.phase) * 0.65 * (1 - p.t),
      );
      pose.scale.setScalar(leaf.size);
      pose.updateMatrix();
      falling.setMatrixAt(i, pose.matrix);
      alphas.setX(i, p.alpha);
    }
    falling.instanceMatrix.needsUpdate = true;
    alphas.needsUpdate = true;
  }
  update(0, false);
  // Base geometry is only an intermediate; each instanced mesh owns its clone.
  geometry.dispose();
  return { falling, ground, seeds, update };
}
