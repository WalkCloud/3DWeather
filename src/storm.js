import * as THREE from "three";
import { stormPulse } from "./spatial-effects.js";

export function createStormEffects(scene, heightAt) {
  const group = new THREE.Group();
  group.name = "Cloud-base lightning";
  group.visible = false;
  scene.add(group);
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const core = new THREE.MeshBasicMaterial({
    color: 0xf3f8ff,
    transparent: true,
    toneMapped: false,
    depthWrite: false,
  });
  const glow = new THREE.MeshBasicMaterial({
    color: 0x8ebcff,
    transparent: true,
    opacity: 0.2,
    toneMapped: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const light = new THREE.PointLight(0xc8ddff, 0, 24, 1.5);
  scene.add(light);
  const skyFlash = new THREE.HemisphereLight(0xd9e9ff, 0x7c91ad, 0);
  scene.add(skyFlash);
  let lastId = -1,
    lastAudioId = -1,
    producer,
    anchorIndex = 0,
    manualRequest = false,
    manualStart = -Infinity,
    manualSequence = 0;
  let sound = false,
    audioContext,
    audioBuffer,
    loading,
    disposed = false;
  const sources = new Set();
  const randomFor = (seed) => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  function makeBolt(id, start) {
    group.clear();
    const random = randomFor(id + 477),
      length = Math.max(
        0.65,
        Math.min(
          3.6 + random() * 0.5,
          start.y - heightAt(start.x, start.z) - 0.65,
        ),
      );
    const main = [];
    for (let i = 0; i <= 11; i++) {
      const t = i / 11;
      main.push(
        new THREE.Vector3(
          (random() - 0.5) * 0.42 * Math.sin(t * Math.PI),
          // Tuck the root slightly into the cloud; the volume masks it and
          // reveals a continuous bolt only below the visible underside.
          0.12 - t * (length + 0.12),
          (random() - 0.5) * 0.4 * Math.sin(t * Math.PI),
        ),
      );
    }
    const paths = [main];
    for (const [at, side] of [
      [4, -1],
      [7, 1],
    ]) {
      const origin = main[at],
        branch = [origin];
      for (let j = 1; j <= 4; j++)
        branch.push(
          new THREE.Vector3(
            origin.x + side * j * 0.15 + (random() - 0.5) * 0.12,
            origin.y - j * 0.25,
            origin.z + side * j * 0.07 + (random() - 0.5) * 0.12,
          ),
        );
      paths.push(branch);
    }
    for (const path of paths)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i],
          direction = b.clone().sub(a),
          length = direction.length();
        for (const [radius, material, order] of [
          // Clouds composite at 20, rain at 10. A nearer cloud must mask a
          // rear bolt as it does rain, including the tucked-in root.
          [0.017, core, 16],
          [0.07, glow, 15],
        ]) {
          const segment = new THREE.Mesh(geometry, material);
          segment.position.copy(a).add(b).multiplyScalar(0.5);
          segment.scale.set(radius, length, radius);
          segment.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize(),
          );
          segment.renderOrder = order;
          group.add(segment);
        }
      }
  }
  async function setSoundEnabled(enabled) {
    sound = !!enabled;
    if (!sound) {
      for (const source of sources)
        try {
          source.stop();
        } catch {}
      sources.clear();
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    try {
      await audioContext.resume();
      if (!audioBuffer && !loading)
        loading = fetch("/assets/audio/thunder.wav")
          .then((r) => r.arrayBuffer())
          .then((data) => audioContext.decodeAudioData(data))
          .then((buffer) => {
            if (!disposed) audioBuffer = buffer;
          })
          .catch(() => {
            sound = false;
          });
    } catch {
      sound = false;
    }
  }
  function thunder(id) {
    if (
      !sound ||
      !audioContext ||
      !audioBuffer ||
      audioContext.state !== "running" ||
      lastAudioId === id
    )
      return;
    lastAudioId = id;
    const source = audioContext.createBufferSource(),
      gain = audioContext.createGain();
    source.buffer = audioBuffer;
    source.playbackRate.value = 0.93 + (id % 7) * 0.018;
    gain.gain.value = 0.22;
    source.connect(gain);
    gain.connect(audioContext.destination);
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start(audioContext.currentTime + 0.55 + (id % 5) * 0.12);
  }
  function update(time, active, producers, allClouds) {
    for (const cloud of allClouds)
      cloud.root.material.uniforms.uFlash.value = 0;
    if (!active || !producers.length) {
      group.visible = false;
      light.intensity = 0;
      skyFlash.intensity = 0;
      lastId = -1;
      manualStart = -Infinity;
      return { flash: 0, cloudFlash: 0 };
    }
    if (manualRequest) {
      manualStart = time;
      manualRequest = false;
      manualSequence++;
    }
    const manual = time - manualStart < 1.05;
    const pulse = stormPulse(manual ? time - manualStart + 0.96 : time);
    const id = manual ? 10000 + manualSequence : pulse.id;
    if ((pulse.flash > 0.01 || pulse.cloud > 0.01) && lastId !== id) {
      lastId = id;
      producer = producers[(id + 1) % producers.length];
      const underside = [];
      for (let i = 0; i < producer.emissionBases.length; i++) {
        const [x, y, z] = producer.emissionBases[i];
        const wx = producer.emissionWorld[i * 3],
          wy = producer.emissionWorld[i * 3 + 1],
          wz = producer.emissionWorld[i * 3 + 2];
        if (
          Math.abs(x) < 0.28 &&
          Math.abs(z) < 0.22 &&
          y < -0.14 &&
          wy - heightAt(wx, wz) > 2.2
        )
          underside.push(i);
      }
      // Use the connected, substantial underside rather than the wispy rim.
      anchorIndex = underside.length
        ? underside[(id * 37 + 41) % underside.length]
        : (id * 37 + 41) % producer.emissionBases.length;
      const start = new THREE.Vector3().fromArray(
        producer.emissionWorld,
        anchorIndex * 3,
      );
      makeBolt(id, start);
    }
    if (producer) {
      group.position.fromArray(producer.emissionWorld, anchorIndex * 3);
      light.position.copy(group.position).add(new THREE.Vector3(0, -1.4, 0));
      for (const cloud of allClouds) {
        const distance = cloud.root.position.distanceTo(producer.root.position);
        cloud.root.material.uniforms.uFlash.value =
          pulse.cloud * Math.exp(-distance * 0.12);
        cloud.root.material.uniforms.uFlashWorld.value.copy(group.position).y +=
          1.0;
      }
    }
    group.visible = pulse.flash > 0.015;
    core.opacity = pulse.flash;
    glow.opacity = pulse.flash * 0.23;
    light.intensity = pulse.flash * 95;
    skyFlash.intensity = pulse.cloud * 0.55;
    if (pulse.flash > 0.08) thunder(id);
    return { flash: pulse.flash, cloudFlash: pulse.cloud };
  }
  function dispose() {
    disposed = true;
    for (const source of sources)
      try {
        source.stop();
      } catch {}
    sources.clear();
    audioContext?.close();
    geometry.dispose();
    core.dispose();
    glow.dispose();
    scene.remove(group, light, skyFlash);
  }
  return {
    update,
    setSoundEnabled,
    trigger() {
      manualRequest = true;
    },
    dispose,
  };
}
