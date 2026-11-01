import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { WEATHER } from "./weather.js";
import { RAIN_PROFILES, rainProfile, isRainCondition } from "./rain.js";
import { createCloudVolume, loadCloudVolumes } from "./clouds.js";
import { CLOUD_BANKS, sampleTerrainHeight } from "./spatial-effects.js";
import { createAutumnLeaves } from "./leaves.js";
import { createStormEffects } from "./storm.js";

const TAU = Math.PI * 2;
function random(seed = 2048) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const POND = [
  [0.31, 0.055],
  [0.365, 0.07],
  [0.43, 0.12],
  [0.455, 0.185],
  [0.43, 0.28],
  [0.375, 0.35],
  [0.27, 0.405],
  [0.165, 0.415],
  [0.125, 0.36],
  [0.14, 0.27],
  [0.18, 0.19],
  [0.23, 0.14],
];
const CLOUD_PRESETS = {
  sunny: {
    counts: { cumulus: 0, companion: 0, stratus: 0, rain: 0 },
    color: 0xffffff,
    opacity: 0.92,
    scale: 0.88,
    yOffset: 0,
    drift: 0.24,
  },
  cloudy: {
    counts: { cumulus: 0, companion: 0, stratus: 4, rain: 0 },
    color: 0xe1e6ec,
    opacity: 0.94,
    scale: 1,
    yOffset: -0.08,
    drift: 0.27,
  },
  ...Object.fromEntries(
    Object.entries(RAIN_PROFILES).map(([condition, profile]) => [
      condition,
      {
        counts: { cumulus: 0, companion: 0, stratus: 0, rain: profile.clouds },
        color: profile.cloudColor,
        opacity: profile.cloudOpacity,
        scale: profile.widthScale,
        thickness: profile.thickness,
        yOffset: 0,
        drift: profile.drift,
      },
    ]),
  ),
  snow: {
    counts: { cumulus: 0, companion: 0, stratus: 4, rain: 0 },
    color: 0xecf5fb,
    opacity: 0.94,
    scale: 1.08,
    yOffset: -0.3,
    drift: 0.24,
  },
  fog: {
    counts: { cumulus: 0, companion: 0, stratus: 2, rain: 0 },
    color: 0xd2dade,
    opacity: 0.68,
    scale: 0.95,
    yOffset: -1.05,
    drift: 0.14,
  },
  windy: {
    counts: { cumulus: 1, companion: 1, stratus: 2, rain: 0 },
    color: 0xe9f1f7,
    opacity: 0.88,
    scale: 1,
    yOffset: 0,
    drift: 1.55,
  },
  night: {
    counts: { cumulus: 0, companion: 0, stratus: 0, rain: 0 },
    color: 0x77879b,
    opacity: 0.55,
    scale: 0.78,
    yOffset: 0,
    drift: 0.18,
  },
};
function insidePond(x, z) {
  let inside = false;
  for (let i = 0, j = POND.length - 1; i < POND.length; j = i++) {
    const a = POND[i],
      b = POND[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function disposeObjects(objects) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  for (const root of objects)
    root?.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      for (const m of (Array.isArray(o.material)
        ? o.material
        : [o.material]
      ).filter(Boolean)) {
        materials.add(m);
        for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      }
      if (o.isSkinnedMesh) o.skeleton?.dispose();
    });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}

export function createWeatherWorld(host, onStatus) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  host.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    "aria-label",
    "3D微缩牧场：左右拖动环绕，滚轮缩放，方向键调整视角，R键复位",
  );
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WEATHER.sunny.sky);
  scene.fog = new THREE.FogExp2(WEATHER.sunny.sky, 0.006);
  const camera = new THREE.OrthographicCamera(-15, 15, 8, -8, 0.1, 160);
  const originalCamera = new THREE.Vector3(8, 15.0, 28),
    originalTarget = new THREE.Vector3(0, 2.25, 0);
  camera.position.copy(originalCamera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(originalTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.minZoom = 0.78;
  controls.maxZoom = 1.5;
  controls.autoRotateSpeed = 0.4;
  const polar =
    Math.PI / 2 -
    Math.atan(
      (originalCamera.y - originalTarget.y) /
        Math.hypot(originalCamera.x, originalCamera.z),
    );
  controls.minPolarAngle = polar;
  controls.maxPolarAngle = polar;
  controls.update();
  controls.saveState();
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentScene = new RoomEnvironment();
  const environmentTarget = environmentGenerator.fromScene(
    environmentScene,
    0.04,
  );
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 1;
  environmentScene.dispose();
  environmentGenerator.dispose();
  const ambient = new THREE.HemisphereLight(0xe3f1ff, 0x6a784f, 0.65);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe9c7, 2.8);
  sun.position.set(-8, 17, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 55;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00008;
  sun.shadow.radius = 3;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xb4dbff, 0.4);
  fill.position.set(10, 9, -8);
  scene.add(fill);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshBasicMaterial({ color: 0xb9d7ed, toneMapped: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.07;
  floor.receiveShadow = true;
  scene.add(floor);
  const groundShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.ShadowMaterial({ color: 0x274963, opacity: 0.24 }),
  );
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = -0.065;
  groundShadow.receiveShadow = true;
  scene.add(groundShadow);
  const cottageLight = new THREE.PointLight(0xffb45c, 0, 7, 2);
  cottageLight.position.set(-1.8, 2, 1.0);
  scene.add(cottageLight);
  const uniforms = {
    time: { value: 0 },
    snow: { value: 0 },
    night: { value: 0 },
    wet: { value: 0 },
    wind: { value: 0.3 },
    autumn: { value: 0 },
  };
  const roots = [],
    mixers = [],
    animals = [],
    fish = [],
    clouds = [],
    ripples = [];
  let disposed = false,
    ready = false,
    frameHandle,
    elapsed = 0,
    last = performance.now(),
    lastData = 0,
    frameCount = 0,
    waterHeight = 0.75,
    waterMaterial,
    waterMesh,
    caustics,
    terrainData,
    groundData,
    skyFraming = 0,
    skyOffset = 0;
  let weather = { ...WEATHER.sunny, condition: "sunny" },
    snowTarget = 0,
    season = "summer",
    dayPhase = "day",
    localHour = 12;
  const rng = random(71);
  const skyTarget = new THREE.Color(WEATHER.sunny.sky),
    floorTarget = new THREE.Color(WEATHER.sunny.sky);
  let snowman, autumnLeaves, groundLeaves, leafEffects;
  const lampBulbs = new Set(),
    lampLights = [];

  function decorateMaterial(material, kind = "surface") {
    material.envMapIntensity = 0.3;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uWeatherSnow: uniforms.snow,
        uWeatherNight: uniforms.night,
        uWeatherWet: uniforms.wet,
        uWeatherAutumn: uniforms.autumn,
      });
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWeatherNormal; varying vec3 vWeatherPosition;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 weatherWorld = vec4(transformed,1.0);
        vec3 weatherNormal = objectNormal;
        #ifdef USE_INSTANCING
          weatherWorld = instanceMatrix * weatherWorld;
          weatherNormal = mat3(instanceMatrix) * weatherNormal;
        #endif
        vWeatherPosition=(modelMatrix*weatherWorld).xyz;
        vWeatherNormal=normalize(mat3(modelMatrix)*weatherNormal);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform float uWeatherSnow; uniform float uWeatherNight; uniform float uWeatherWet; uniform float uWeatherAutumn; varying vec3 vWeatherNormal; varying vec3 vWeatherPosition;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 snowP=vWeatherPosition.xz;
        float snowNoise=0.5+0.25*sin(snowP.x*.9+sin(snowP.y*.6))+0.25*cos(snowP.y*.85+sin(snowP.x*.5));
        float snowPatch=smoothstep(1.0-uWeatherSnow-.08,1.0-uWeatherSnow+.08,snowNoise)*smoothstep(0.0,.1,uWeatherSnow);
        float snowCoverage=max(snowPatch,smoothstep(.62,.94,uWeatherSnow));
        float snowSurface=smoothstep(0.15,0.72,vWeatherNormal.y)*snowCoverage*${kind === "animal" ? "0.0" : "1.0"};
        float weatherLuma=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
        diffuseColor.rgb=mix(vec3(weatherLuma),diffuseColor.rgb,1.06)*${kind === "surface" ? "0.64" : kind === "house" ? "0.76" : kind === "animal" ? "0.85" : "1.0"};
        float greenness=clamp((diffuseColor.g-diffuseColor.r*.88)*5.0,0.0,1.0)*clamp((diffuseColor.g-diffuseColor.b*.88)*5.0,0.0,1.0);
        vec3 autumnTone=mix(vec3(.74,.34,.08),vec3(.95,.68,.16),fract(vWeatherPosition.x*.17+vWeatherPosition.z*.23));
        diffuseColor.rgb=mix(diffuseColor.rgb,autumnTone,greenness*uWeatherAutumn*${kind === "surface" || kind === "grass" ? "0.88" : "0.0"});
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.94,0.97,1.0),snowSurface);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor *= mix(1.0,0.65,uWeatherWet*(1.0-uWeatherSnow));",
      );
      if (kind === "house")
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
        float warmWindow=step(0.33,diffuseColor.r)*step(0.60,diffuseColor.g/max(diffuseColor.r,0.001))*(1.0-step(0.42,diffuseColor.b/max(diffuseColor.r,0.001)));
        totalEmissiveRadiance+=warmWindow*uWeatherNight*vec3(1.0,0.48,0.10);`,
        );
    };
    material.customProgramCacheKey = () => `pocket-weather-${kind}`;
    return material;
  }
  function prepare(root, kind = "surface") {
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const source = Array.isArray(o.material) ? o.material : [o.material];
        const mats = source.map((m) => decorateMaterial(m.clone(), kind));
        o.material = Array.isArray(o.material) ? mats : mats[0];
        if (o.isSkinnedMesh) o.frustumCulled = false;
      }
    });
    return root;
  }
  function heightAt(x, z) {
    return sampleTerrainHeight(terrainData, x, z);
  }
  function groundAt(x, z) {
    return sampleTerrainHeight(groundData, x, z);
  }
  function frameSky() {
    const aspect = host.clientWidth / host.clientHeight;
    const viewHeight =
      (aspect < 1.1 ? 21 / aspect : 14.5) *
      (1 + skyFraming * (18.3 / 14.5 - 1));
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }
  function resize() {
    if (disposed) return;
    const w = host.clientWidth,
      h = host.clientHeight;
    frameSky();
    renderer.setSize(w, h, false);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const keyControl = (e) => {
    if (e.key === "ArrowLeft") {
      controls.autoRotate = false;
      camera.position
        .sub(controls.target)
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.12)
        .add(controls.target);
      controls.update();
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      camera.position
        .sub(controls.target)
        .applyAxisAngle(THREE.Object3D.DEFAULT_UP, -0.12)
        .add(controls.target);
      controls.update();
      e.preventDefault();
    }
    if (e.key.toLowerCase() === "r") reset();
  };
  renderer.domElement.addEventListener("keydown", keyControl);
  const lostContext = (e) => {
    e.preventDefault();
    if (!disposed)
      onStatus({ ready: false, error: "浏览器的3D画布暂时中断，请重新载入。" });
  };
  renderer.domElement.addEventListener("webglcontextlost", lostContext);

  const manager = new THREE.LoadingManager();
  let maxProgress = 0;
  manager.onProgress = (_url, loaded, total) => {
    if (!disposed) {
      maxProgress = Math.max(
        maxProgress,
        Math.min(0.94, (loaded / total) * 0.9),
      );
      onStatus({ progress: maxProgress });
    }
  };
  const loader = new GLTFLoader(manager);
  const abort = new AbortController();
  async function load(name) {
    const gltf = await loader.loadAsync(`/assets/models/${name}.glb`);
    if (disposed) {
      disposeObjects([gltf.scene]);
      return null;
    }
    roots.push(gltf.scene);
    return gltf;
  }
  Promise.all([
    load("terrain"),
    load("cottage"),
    load("cow"),
    load("sheep"),
    load("horse"),
    load("fish"),
    load("autumn-leaf"),
    loadCloudVolumes(abort.signal),
    fetch("/assets/terrain-heights.json", { signal: abort.signal }).then(
      (r) => {
        if (!r.ok) throw new Error("地形高度文件载入失败");
        return r.json();
      },
    ),
    fetch("/assets/terrain-ground-heights.json", { signal: abort.signal }).then(
      (r) => {
        if (!r.ok) throw new Error("Ground surface failed to load");
        return r.json();
      },
    ),
    fetch("/assets/tree-anchors.json", { signal: abort.signal }).then((r) => {
      if (!r.ok) throw new Error("Tree anchors failed to load");
      return r.json();
    }),
  ])
    .then(
      ([
        terrain,
        house,
        cow,
        sheep,
        horse,
        koi,
        leaf,
        cloudVolumes,
        data,
        ground,
        anchors,
      ]) => {
        if (disposed) {
          Object.values(cloudVolumes).forEach((texture) => texture.dispose());
          return;
        }
        terrainData = data;
        groundData = ground;
        prepare(terrain.scene);
        terrain.scene.scale.set(18, 18, 15);
        scene.add(terrain.scene);
        prepare(house.scene, "house");
        const houseGroup = new THREE.Group();
        houseGroup.add(house.scene);
        houseGroup.scale.setScalar(4.8);
        houseGroup.position.set(-3.1, heightAt(-3.1, 0) - 0.02, 0);
        scene.add(houseGroup);
        cottageLight.position.set(-1.5, houseGroup.position.y + 1.4, 1.15);
        for (const source of [cow, sheep, horse])
          prepare(source.scene, "animal");
        const specs = [
          ["cow", cow, 1.25, -5.1, 3.0, 0.35],
          ["cow", cow, 1.2, -2.7, 3.1, -0.3],
          ["sheep", sheep, 0.98, -3.7, 4.7, -0.1],
          ["sheep", sheep, 0.94, -2.4, 4.5, -0.1],
          ["sheep", sheep, 0.9, -1, 5.2, 0.6],
          ["horse", horse, 1.7, 0.55, 2.5, Math.PI + 0.35],
          ["horse", horse, 1.62, 2.25, 1.5, Math.PI + 0.65],
        ];
        for (const [kind, gltf, scale, x, z, angle] of specs) {
          const object = cloneSkeleton(gltf.scene),
            group = new THREE.Group();
          group.add(object);
          group.scale.setScalar(scale);
          group.position.set(x, heightAt(x, z), z);
          group.rotation.y = angle;
          scene.add(group);
          const mixer = new THREE.AnimationMixer(object),
            clips = gltf.animations;
          const graze =
              clips.find((c) => /graz|eat|idle/i.test(c.name)) || clips[0],
            walk = clips.find((c) => /walk/i.test(c.name)) || graze;
          const grazeAction = graze ? mixer.clipAction(graze) : null,
            walkAction = walk ? mixer.clipAction(walk) : null;
          grazeAction?.play();
          if (grazeAction) grazeAction.time = rng() * 4;
          mixers.push(mixer);
          animals.push({
            kind,
            group,
            object,
            mixer,
            grazeAction,
            walkAction,
            home: new THREE.Vector3(x, heightAt(x, z), z),
            angle,
            phase: rng() * TAU,
            seed: rng(),
            walking: false,
          });
        }
        makeWater();
        makeGrass();
        makeFish(koi);
        makeClouds(cloudVolumes);
        makeSnowman();
        makeAutumnLeaves(leaf, anchors);
        makeNightLights();
        makeWeatherParticles();
        ready = true;
        host.dataset.ready = "true";
        onStatus({ progress: 1, ready: true });
      },
    )
    .catch((error) => {
      if (!disposed)
        onStatus({ ready: false, error: error.message || "3D素材载入失败" });
    });

  function pondGeometry(y) {
    const contour = POND.map((p) => new THREE.Vector2(p[0], p[1])),
      indices = THREE.ShapeUtils.triangulateShape(contour, []).flat(),
      positions = POND.flatMap((p) => [p[0] * 18, y, p[1] * 15]),
      uv = POND.flatMap((p) => [(p[0] - 0.1) / 0.38, (p[1] - 0.04) / 0.4]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  function makeWater() {
    waterHeight =
      Math.max(heightAt(5, 3.9), heightAt(4.3, 4.6), heightAt(5.7, 3.1)) + 0.22;
    waterMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: uniforms.time,
        uSnow: uniforms.snow,
        uNight: uniforms.night,
      },
      vertexShader: `varying vec3 vPond; uniform float uTime; void main(){vec3 p=position;p.y+=sin(p.x*2.5+uTime)*cos(p.z*2.8-uTime*.7)*.014;vPond=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `varying vec3 vPond;uniform float uTime;uniform float uSnow;uniform float uNight;void main(){vec2 p=vPond.xz;float wave=sin(p.x*3.7+uTime*.6)*cos(p.y*4.2-uTime*.45);float glint=pow(max(0.,sin(p.x*8.+sin(p.y*6.+uTime*.4))),28.)*.025;vec3 c=vec3(.008,.30,.39)+wave*.022+glint; c=mix(c,vec3(.43,.71,.76),uSnow*.7);c*=1.-uNight*.65;gl_FragColor=vec4(c,.59);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    });
    waterMesh = new THREE.Mesh(pondGeometry(waterHeight), waterMaterial);
    waterMesh.renderOrder = 6;
    scene.add(waterMesh);
    const causticMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: uniforms.time, uNight: uniforms.night },
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec2 vUv; uniform float uTime;uniform float uNight;
    vec2 hash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
    void main(){vec2 p=vUv*9.;p+=vec2(sin(p.y+uTime*.3),cos(p.x-uTime*.25))*.22;vec2 cell=floor(p),f=fract(p);float first=10.,second=10.;
    for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 h=hash(cell+g);vec2 r=g+.5+.32*sin(uTime*.26+6.283*h)-f;float d=dot(r,r);if(d<first){second=first;first=d;}else if(d<second){second=d;}}}
    float edge=1.-smoothstep(.012,.07,second-first);gl_FragColor=vec4(.72,1.,1.,edge*.23*(1.-uNight*.7));}`,
    });
    caustics = new THREE.Mesh(
      pondGeometry(waterHeight - 0.13),
      causticMaterial,
    );
    caustics.renderOrder = 3;
    scene.add(caustics);
    const ringGeo = new THREE.TorusGeometry(0.24, 0.006, 4, 48);
    for (let i = 0; i < 18; i++) {
      let x, z;
      do {
        x = 0.15 + rng() * 0.28;
        z = 0.08 + rng() * 0.3;
      } while (!insidePond(x, z));
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd6ffff,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x * 18, waterHeight + 0.025, z * 15);
      ring.renderOrder = 7;
      scene.add(ring);
      ripples.push({ ring, phase: rng() });
    }
  }
  function makeGrass() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.018, 0, 0, 0.018, 0, 0, -0.011, 0.11, 0.008, 0.011, 0.11, 0.008, 0,
          0.22, 0.035,
        ],
        3,
      ),
    );
    geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    geometry.computeVertexNormals();
    const material = decorateMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x6b8f38,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
      "grass",
    );
    const baseCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader) => {
      baseCompile(shader);
      shader.uniforms.uGrassTime = uniforms.time;
      shader.uniforms.uGrassWind = uniforms.wind;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nuniform float uGrassTime;uniform float uGrassWind;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat grassPhase=instanceMatrix[3].x*1.3+instanceMatrix[3].z;transformed.x+=sin(uGrassTime*1.8+grassPhase)*position.y*position.y*uGrassWind*2.;",
      );
    };
    const count = 13000,
      grass = new THREE.InstancedMesh(geometry, material, count),
      dummy = new THREE.Object3D(),
      color = new THREE.Color();
    let written = 0;
    for (let attempt = 0; attempt < count * 9 && written < count; attempt++) {
      const x = (rng() - 0.5) * 16,
        z = (rng() - 0.5) * 13;
      if (insidePond(x / 18, z / 15)) continue;
      if (x > -5.5 && x < -0.8 && z > -1.6 && z < 1.65) continue;
      const y = heightAt(x, z);
      if (y < 0.28 || y > 1.8) continue;
      dummy.position.set(x, y - 0.01, z);
      dummy.rotation.set((rng() - 0.5) * 0.15, rng() * TAU, 0);
      dummy.scale.setScalar(0.55 + rng() * 0.55);
      dummy.updateMatrix();
      grass.setMatrixAt(written, dummy.matrix);
      color.setHSL(
        0.23 + rng() * 0.045,
        0.46 + rng() * 0.15,
        0.4 + rng() * 0.13,
      );
      grass.setColorAt(written, color);
      written++;
    }
    grass.count = written;
    grass.receiveShadow = false;
    grass.castShadow = false;
    grass.instanceMatrix.needsUpdate = true;
    scene.add(grass);
  }

  function makeSnowman() {
    snowman = new THREE.Group();
    const snow = new THREE.MeshStandardMaterial({
      color: 0xf7fbff,
      roughness: 0.62,
      metalness: 0,
    });
    const coal = new THREE.MeshStandardMaterial({
      color: 0x24272c,
      roughness: 0.35,
    });
    const carrot = new THREE.MeshStandardMaterial({
      color: 0xe8762a,
      roughness: 0.55,
    });
    const scarf = new THREE.MeshStandardMaterial({
      color: 0xc4453b,
      roughness: 0.8,
    });
    const wood = new THREE.MeshStandardMaterial({
      color: 0x614028,
      roughness: 0.85,
    });
    const add = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      snowman.add(mesh);
      return mesh;
    };
    const bottom = add(
      new THREE.Mesh(new THREE.SphereGeometry(0.37, 28, 20), snow),
    );
    const middle = add(
      new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 20), snow),
    );
    const head = add(
      new THREE.Mesh(new THREE.SphereGeometry(0.185, 28, 20), snow),
    );
    bottom.position.y = 0.3;
    middle.position.y = 0.78;
    head.position.y = 1.11;
    for (const [x, y, z, scale] of [
      [-0.06, 1.15, 0.16, 0.022],
      [0.06, 1.15, 0.16, 0.022],
      [0, 0.84, 0.25, 0.019],
      [0.05, 0.75, 0.25, 0.019],
    ]) {
      const eye = add(
        new THREE.Mesh(new THREE.SphereGeometry(scale, 10, 8), coal),
      );
      eye.position.set(x, y, z);
    }
    const nose = add(
      new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.19, 12), carrot),
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.1, 0.22);
    const band = add(
      new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 10, 28), scarf),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.96;
    const scarfTail = add(
      new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.035), scarf),
    );
    scarfTail.position.set(0.15, 0.78, 0.18);
    scarfTail.rotation.z = 0.18;
    for (const side of [-1, 1]) {
      const arm = add(
        new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.009, 0.58, 7), wood),
      );
      arm.position.set(side * 0.33, 0.86, 0);
      arm.rotation.z = side * -1.05;
    }
    snowman.position.set(-0.15, heightAt(-0.15, 4.9) - 0.02, 4.9);
    snowman.rotation.y = -0.35;
    snowman.visible = false;
    scene.add(snowman);
  }

  function makeAutumnLeaves(leaf, anchors) {
    leafEffects = createAutumnLeaves(scene, leaf, anchors, groundAt, rng);
    autumnLeaves = leafEffects.falling;
    groundLeaves = leafEffects.ground;
    host.dataset.leafTrees = String(anchors.trees.length);
    host.dataset.leafSources = "model-canopy-surfaces";
  }

  function makeNightLights() {
    const poleMaterial = new THREE.MeshStandardMaterial({
      color: 0x34424d,
      roughness: 0.55,
      metalness: 0.25,
    });
    for (const [x, z] of [
      [-1.35, 2.35],
      [1.65, 1.35],
    ]) {
      const base = heightAt(x, z);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.042, 0.95, 10),
        poleMaterial,
      );
      pole.position.set(x, base + 0.48, z);
      pole.castShadow = true;
      const bulbMaterial = new THREE.MeshStandardMaterial({
        color: 0xffe5a8,
        emissive: 0xffb45c,
        emissiveIntensity: 0,
        roughness: 0.3,
      });
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 18, 14),
        bulbMaterial,
      );
      bulb.position.set(x, base + 1.01, z);
      lampBulbs.add(bulbMaterial);
      const light = new THREE.PointLight(0xffbe66, 0, 4.6, 2);
      light.position.copy(bulb.position);
      lampLights.push(light);
      scene.add(pole, bulb, light);
    }
  }
  function makeFish(gltf) {
    for (let i = 0; i < 9; i++) {
      const object = cloneSkeleton(gltf.scene);
      object.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = false;
          o.renderOrder = 7;
          o.material = (
            Array.isArray(o.material) ? o.material : [o.material]
          ).map((m) => Object.assign(m.clone(), { envMapIntensity: 0.25 }));
          if (o.material.length === 1) o.material = o.material[0];
        }
      });
      const group = new THREE.Group();
      group.add(object);
      group.scale.setScalar(0.38 + rng() * 0.16);
      scene.add(group);
      const mixer = new THREE.AnimationMixer(object);
      if (gltf.animations[0]) {
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        action.time = rng() * 2;
      }
      mixers.push(mixer);
      fish.push({
        group,
        mixer,
        phase: (i * TAU) / 9,
        rate: 0.11 + rng() * 0.1,
        radius: 0.4 + rng() * 0.45,
      });
    }
  }
  function makeClouds(sources) {
    const specifications = [
      {
        role: "cumulus",
        at: [-3.7, 9.6, -1.8],
        width: 4.3,
        height: 3.1,
        depth: 3.2,
        opacity: 1,
        rotation: -0.25,
      },
      {
        role: "companion",
        at: [3.5, 9.8, 1.6],
        width: 3.5,
        height: 2.6,
        depth: 2.8,
        opacity: 0.9,
        rotation: 0.45,
      },
      ...Object.entries(CLOUD_BANKS).flatMap(([role, banks]) =>
        banks.map((bank) => ({ role, ...bank })),
      ),
    ];
    const roleCounts = { cumulus: 0, companion: 0, stratus: 0, rain: 0 };
    for (const specification of specifications) {
      const texture =
        sources[
          specification.role === "companion"
            ? "cumulus"
            : specification.role === "rain"
              ? "rainLight"
              : specification.role
        ];
      const root = createCloudVolume(texture, rng() * 100, sun);
      const material = root.material;
      material.opacity = 0;
      material.color = material.uniforms.uColor.value;
      root.scale.set(
        specification.width,
        specification.height,
        specification.depth,
      );
      root.position.set(...specification.at);
      root.rotation.y = specification.rotation;
      // Composite the soft cloud volume over precipitation. Rear rain must not
      // be painted across a nearer cloud, whose volume has no opaque depth.
      root.renderOrder = 20;
      scene.add(root);
      clouds.push({
        root,
        volumes: sources,
        emissionBases: texture.userData.precipitationBases,
        emissionWorld: new Float32Array(
          texture.userData.precipitationBases.length * 3,
        ),
        materials: new Set([material]),
        size: new THREE.Vector3(1, 1, 1),
        role: specification.role,
        roleIndex: roleCounts[specification.role]++,
        base: new THREE.Vector3(...specification.at),
        width: specification.width,
        height: specification.height,
        depth: specification.depth,
        opacity: specification.opacity,
        phase: rng() * TAU,
      });
    }
    host.dataset.cloudRenderer = "volume";
  }
  let rain, snowfall, stars;
  const rainSeeds = [];
  const snowSeeds = [];
  function makeWeatherParticles() {
    const positions = new Float32Array(2600 * 6);
    for (let i = 0; i < 2600; i++)
      rainSeeds.push({
        cloudIndex: i % 4,
        u: (rng() - 0.5) * 0.84,
        v: (rng() - 0.5) * 0.34,
        phase: rng() * 8,
        speed: 5 + rng() * 2,
      });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xe4f6ff,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    rain.visible = false;
    rain.frustumCulled = false;
    rain.renderOrder = 10;
    scene.add(rain);
    const snowPositions = [],
      snowSizes = [],
      snowPhases = [];
    for (let i = 0; i < 1800; i++) {
      snowPositions.push(0, 5.5, 0);
      snowSizes.push(1.7 + rng() * 2.8);
      snowPhases.push(rng() * TAU);
      snowSeeds.push({
        cloudIndex: i % 4,
        u: (rng() - 0.5) * 0.86,
        v: (rng() - 0.5) * 0.36,
        phase: rng() * 9,
        speed: 0.65 + rng() * 0.35,
      });
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(snowPositions, 3),
    );
    snowGeo.setAttribute(
      "aSize",
      new THREE.Float32BufferAttribute(snowSizes, 1),
    );
    snowGeo.setAttribute(
      "aPhase",
      new THREE.Float32BufferAttribute(snowPhases, 1),
    );
    const snowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: uniforms.time,
        uDpr: { value: Math.min(window.devicePixelRatio || 1, 1.75) },
      },
      vertexShader:
        "uniform float uTime;uniform float uDpr;attribute float aSize;attribute float aPhase;void main(){vec3 p=position;p.x+=sin(uTime*.45+aPhase)*.16;p.z+=cos(uTime*.33+aPhase)*.11;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=aSize*uDpr;}",
      fragmentShader:
        "void main(){vec2 p=gl_PointCoord-.5;float r=length(p);float arm=1.-smoothstep(.015,.065,abs(sin(atan(p.y,p.x)*3.))*r);float core=1.-smoothstep(.08,.16,r);float a=max(core,arm)*(1.-smoothstep(.35,.49,r));if(a<.05)discard;gl_FragColor=vec4(.97,.99,1.,a*.9);}",
    });
    snowfall = new THREE.Points(snowGeo, snowMat);
    snowfall.visible = false;
    snowfall.frustumCulled = false;
    snowfall.renderOrder = 10;
    scene.add(snowfall);
    const starPositions = [];
    for (let i = 0; i < 170; i++)
      starPositions.push((rng() - 0.5) * 45, 4.5 + rng() * 5, 0);
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );
    stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xfff4d6,
        size: 0.035,
        depthTest: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    stars.renderOrder = -2;
    scene.add(stars);
  }
  let stormEpoch = 0,
    stormArmed = false;
  const stormEffects = createStormEffects(scene, heightAt);
  function setWeather(next, snowAmount = 0, nextSeason = season) {
    const previous = weather.condition;
    weather = next;
    season = nextSeason;
    const profile = WEATHER[next.condition] || WEATHER.sunny;
    skyTarget.set(profile.sky);
    floorTarget.set(profile.sky);
    snowTarget = THREE.MathUtils.clamp(Number(snowAmount) || 0, 0, 1);
    if (next.condition !== previous) {
      stormArmed = false;
      stormEpoch = elapsed;
    }
    if (ready && previous !== next.condition) {
      const arrivingRole =
        next.condition === "snow"
          ? "stratus"
          : isRainCondition(next.condition) && !isRainCondition(previous)
            ? "rain"
            : null;
      if (arrivingRole)
        for (const cloud of clouds)
          if (cloud.role === arrivingRole)
            cloud.root.position.x = cloud.base.x - 14;
    }
  }
  function setEnvironment(environment = {}) {
    if (environment.season) season = environment.season;
    if (environment.phase) dayPhase = environment.phase;
    if (Number.isFinite(Number(environment.hour)))
      localHour = THREE.MathUtils.clamp(Number(environment.hour), 0, 24);
  }
  function setAutoRotate(value) {
    controls.autoRotate = !!value;
  }
  function reset() {
    controls.reset();
    controls.target.copy(originalTarget);
    controls.target.y += skyOffset;
    camera.position.copy(originalCamera);
    camera.position.y += skyOffset;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
  }
  function animate(now) {
    frameHandle = requestAnimationFrame(animate);
    const delta = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (disposed || document.hidden) return;
    elapsed += delta;
    uniforms.time.value = elapsed;
    const condition = weather.condition,
      rainVisual = rainProfile(condition),
      wet = !!rainVisual,
      overcast = condition === "cloudy",
      manualNight = condition === "night",
      night = manualNight || dayPhase === "night",
      twilight = dayPhase === "dawn" || dayPhase === "dusk";
    const alpha = 1 - Math.exp(-delta * 1.3);
    const nextFraming = THREE.MathUtils.lerp(
      skyFraming,
      condition !== "sunny" && condition !== "night" ? 1 : 0,
      alpha,
    );
    const nextOffset = nextFraming * 1.25;
    camera.position.y += nextOffset - skyOffset;
    controls.target.y += nextOffset - skyOffset;
    skyOffset = nextOffset;
    if (Math.abs(nextFraming - skyFraming) > 0.00001) {
      skyFraming = nextFraming;
      frameSky();
    }
    const autumnTarget = season === "autumn" ? 1 : 0;
    uniforms.autumn.value = THREE.MathUtils.lerp(
      uniforms.autumn.value,
      autumnTarget,
      alpha,
    );
    const profile = WEATHER[condition] || WEATHER.sunny;
    const timedSky = new THREE.Color(profile.sky);
    if (night) timedSky.lerp(new THREE.Color(0x1b3049), 0.82);
    if (dayPhase === "dawn") timedSky.lerp(new THREE.Color(0xf3ae7f), 0.2);
    if (dayPhase === "dusk") timedSky.lerp(new THREE.Color(0xe58d5e), 0.24);
    skyTarget.copy(timedSky);
    floorTarget.copy(timedSky);
    const daylight = night ? 0.04 : twilight ? 0.5 : 1;
    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      renderer.toneMappingExposure,
      night ? 0.9 : rainVisual ? rainVisual.exposure : overcast ? 0.77 : 0.9,
      alpha,
    );
    const sunAngle = ((localHour - 6) / 12) * Math.PI;
    sun.position.set(
      Math.cos(sunAngle) * 15,
      Math.max(2.5, Math.sin(sunAngle) * 17),
      5,
    );
    uniforms.snow.value = THREE.MathUtils.lerp(
      uniforms.snow.value,
      snowTarget,
      alpha,
    );
    uniforms.night.value = THREE.MathUtils.lerp(
      uniforms.night.value,
      night
        ? 1
        : twilight
          ? 0.28
          : condition === "storm"
            ? 0.55
            : wet
              ? 0.3
              : condition === "snow"
                ? 0.12
                : 0,
      alpha,
    );
    uniforms.wet.value = THREE.MathUtils.lerp(
      uniforms.wet.value,
      rainVisual ? rainVisual.wetness : 0,
      alpha,
    );
    uniforms.wind.value = THREE.MathUtils.lerp(
      uniforms.wind.value,
      0.22 + (weather.wind || 2) * 0.15,
      alpha,
    );
    scene.background.lerp(skyTarget, alpha);
    scene.fog.color.copy(scene.background);
    scene.fog.density = THREE.MathUtils.lerp(
      scene.fog.density,
      condition === "fog" ? 0.027 : rainVisual ? rainVisual.fog : 0.006,
      alpha,
    );
    floor.material.color.lerp(floorTarget, alpha);
    scene.environmentIntensity = THREE.MathUtils.lerp(
      scene.environmentIntensity,
      night
        ? 0.1
        : rainVisual
          ? rainVisual.environment
          : overcast
            ? 0.76
            : 0.38 + daylight * 0.62,
      alpha,
    );
    ambient.intensity = THREE.MathUtils.lerp(
      ambient.intensity,
      rainVisual
        ? 0.14 + daylight * (rainVisual.ambient - 0.14)
        : 0.14 + daylight * (overcast ? 0.68 : 0.52),
      alpha,
    );
    ambient.color.lerp(
      new THREE.Color(overcast || wet ? 0xd6e1ed : 0xe3f1ff),
      alpha,
    );
    ambient.groundColor.lerp(
      new THREE.Color(overcast || wet ? 0x838981 : 0x6a784f),
      alpha,
    );
    sun.color.lerp(
      new THREE.Color(overcast || wet ? 0xdce5ef : 0xffe9c7),
      alpha,
    );
    sun.shadow.intensity = THREE.MathUtils.lerp(
      sun.shadow.intensity,
      overcast || wet ? 0.18 : 1,
      alpha,
    );
    sun.shadow.radius = THREE.MathUtils.lerp(
      sun.shadow.radius,
      overcast || wet ? 5 : 3,
      alpha,
    );
    sun.intensity = THREE.MathUtils.lerp(
      sun.intensity,
      Math.max(
        overcast || wet ? 0.02 : 0.14,
        daylight *
          (rainVisual
            ? rainVisual.sun
            : overcast
              ? 0.22
              : condition === "fog"
                ? 1.2
                : 2.8),
      ),
      alpha,
    );
    fill.intensity = THREE.MathUtils.lerp(
      fill.intensity,
      night ? 0.2 : 0.4,
      alpha,
    );
    cottageLight.intensity = THREE.MathUtils.lerp(
      cottageLight.intensity,
      night ? 8.2 : twilight ? 2.6 : wet ? 4.4 : 0.7,
      alpha,
    );
    for (const material of lampBulbs)
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        night ? 4.5 : twilight ? 1.8 : 0.12,
        alpha,
      );
    for (const light of lampLights)
      light.intensity = THREE.MathUtils.lerp(
        light.intensity,
        night ? 5.2 : twilight ? 1.8 : 0,
        alpha,
      );
    if (ready) {
      for (const mixer of mixers) mixer.update(delta);
      autumnLeaves.visible =
        season === "autumn" &&
        uniforms.snow.value < 0.35 &&
        !wet &&
        condition !== "snow";
      groundLeaves.visible = season === "autumn" && uniforms.snow.value < 0.4;
      leafEffects.update(elapsed, autumnLeaves.visible, groundLeaves.visible);
      snowman.visible = season === "winter" || uniforms.snow.value > 0.2;
      const snowmanScale = uniforms.snow.value > 0.7 ? 1 : 0.72;
      snowman.scale.lerp(
        new THREE.Vector3(snowmanScale, snowmanScale, snowmanScale),
        alpha,
      );
      const severe = wet || condition === "snow" || night;
      let visibleAnimals = 0;
      for (let i = 0; i < animals.length; i++) {
        const animal = animals[i],
          visible =
            !severe ||
            (rainVisual ? rainVisual.animals : [0, 2, 5]).includes(i);
        animal.group.visible = visible;
        if (!visible) continue;
        visibleAnimals++;
        const sheltered =
          i === 0 ? [-3.9, 2.35] : i === 2 ? [-5.1, 2.0] : [-0.85, 2.05];
        const tx = severe
            ? sheltered[0]
            : animal.home.x + Math.sin(elapsed * 0.065 + animal.phase) * 0.16,
          tz = severe
            ? sheltered[1]
            : animal.home.z + Math.cos(elapsed * 0.06 + animal.phase) * 0.12;
        const dx = tx - animal.group.position.x,
          dz = tz - animal.group.position.z,
          moving = Math.hypot(dx, dz) > 0.2;
        if (
          moving !== animal.walking &&
          animal.walkAction &&
          animal.grazeAction &&
          animal.walkAction !== animal.grazeAction
        ) {
          const next = moving ? animal.walkAction : animal.grazeAction,
            old = moving ? animal.grazeAction : animal.walkAction;
          next.reset().setEffectiveWeight(1).play();
          next.crossFadeFrom(old, 0.6, true);
          animal.walking = moving;
        }
        animal.group.position.x = THREE.MathUtils.damp(
          animal.group.position.x,
          tx,
          moving ? 0.75 : 0.16,
          delta,
        );
        animal.group.position.z = THREE.MathUtils.damp(
          animal.group.position.z,
          tz,
          moving ? 0.75 : 0.16,
          delta,
        );
        animal.group.position.y = THREE.MathUtils.damp(
          animal.group.position.y,
          heightAt(animal.group.position.x, animal.group.position.z) +
            uniforms.snow.value * 0.025,
          5,
          delta,
        );
        const targetAngle = moving ? -Math.atan2(dz, dx) : animal.angle;
        const difference =
          THREE.MathUtils.euclideanModulo(
            targetAngle - animal.group.rotation.y + Math.PI,
            TAU,
          ) - Math.PI;
        animal.group.rotation.y += difference * (1 - Math.exp(-delta * 2));
        animal.mixer.timeScale = 0.76 + animal.seed * 0.25;
      }

      for (let i = 0; i < fish.length; i++) {
        const f = fish[i],
          t = elapsed * f.rate + f.phase,
          r = f.radius;
        f.group.position.set(
          (0.285 + Math.cos(t) * 0.087 * r) * 18,
          waterHeight - 0.08 - Math.sin(t * 1.2 + i) * 0.035,
          (0.255 + Math.sin(t) * 0.105 * r) * 15,
        );
        f.group.rotation.y = -Math.atan2(
          Math.cos(t) * 0.105 * 15,
          -Math.sin(t) * 0.087 * 18,
        );
        f.mixer.timeScale = condition === "snow" ? 0.65 : 1.0;
      }
      for (const { ring, phase } of ripples) {
        const p =
          (elapsed * (rainVisual ? rainVisual.rippleSpeed : 0.32) + phase) % 1;
        ring.scale.setScalar(0.15 + p * 1.6);
        ring.material.opacity =
          (rainVisual ? rainVisual.rippleOpacity : 0.055) * (1 - p);
      }
      const cloudCondition =
          condition === "sunny" && night ? "night" : condition,
        cloudPreset = CLOUD_PRESETS[cloudCondition] || CLOUD_PRESETS.sunny,
        cloudColor = new THREE.Color(cloudPreset.color);
      if (night && cloudCondition !== "night") cloudColor.multiplyScalar(0.58);
      let cloudsVisible = 0;
      for (const cloud of clouds) {
        const visible = cloudPreset.counts[cloud.role] > cloud.roleIndex;
        if (cloud.role === "rain" && rainVisual) {
          const density = cloud.volumes[rainVisual.texture];
          if (cloud.root.material.uniforms.uDensity.value !== density) {
            cloud.root.material.uniforms.uDensity.value = density;
            cloud.emissionBases = density.userData.precipitationBases;
            cloud.emissionWorld = new Float32Array(
              cloud.emissionBases.length * 3,
            );
          }
        }
        const targetOpacity = visible ? cloudPreset.opacity * cloud.opacity : 0;
        let materialOpacity = 0;
        for (const material of cloud.materials) {
          material.opacity = THREE.MathUtils.lerp(
            material.opacity,
            targetOpacity,
            alpha,
          );
          material.color.lerp(cloudColor, alpha);
          material.uniforms.uOpacity.value = material.opacity;
          material.uniforms.uTime.value = elapsed;
          material.uniforms.uShade.value
            .copy(cloudColor)
            .multiplyScalar(
              overcast ? 0.28 : rainVisual ? rainVisual.cloudShade : 0.44,
            );
          material.uniforms.uExtinction.value = rainVisual
            ? rainVisual.extinction
            : 17;
          materialOpacity = material.opacity;
        }
        cloud.root.visible = materialOpacity > 0.015;
        if (cloud.root.visible && targetOpacity > 0) cloudsVisible++;
        cloud.root.scale.lerp(
          new THREE.Vector3(
            (cloud.width * cloudPreset.scale) / cloud.size.x,
            (cloud.height *
              (cloudPreset.thickness ?? cloudPreset.scale) *
              0.94) /
              cloud.size.y,
            (cloud.depth * cloudPreset.scale) / cloud.size.z,
          ),
          alpha,
        );
        const targetX =
          cloud.base.x +
          Math.sin(elapsed * (0.025 + cloudPreset.drift * 0.08) + cloud.phase) *
            (0.22 + cloudPreset.drift * 0.35);
        cloud.root.position.x = THREE.MathUtils.damp(
          cloud.root.position.x,
          targetX,
          0.85,
          delta,
        );
        cloud.root.position.y = THREE.MathUtils.lerp(
          cloud.root.position.y,
          cloud.base.y +
            cloudPreset.yOffset +
            Math.sin(elapsed * 0.18 + cloud.phase) * 0.07,
          alpha,
        );
        cloud.root.position.z = cloud.base.z;
      }
      const precipitationRole = wet
          ? "rain"
          : condition === "snow"
            ? "stratus"
            : null,
        precipitationClouds = precipitationRole
          ? clouds
              .filter(
                (cloud) =>
                  cloud.role === precipitationRole &&
                  (!wet ||
                    Math.abs(cloud.root.position.x - cloud.base.x) < 1.0) &&
                  [...cloud.materials].some(
                    (material) => material.opacity > 0.24,
                  ),
              )
              .slice(0, rainVisual ? rainVisual.clouds : 4)
          : [];
      // Transform density-derived cloud bases once per frame. Particle origins
      // follow the cloud's actual silhouette, scale, rotation and arrival motion.
      for (const cloud of precipitationClouds) {
        const cosine = Math.cos(cloud.root.rotation.y),
          sine = Math.sin(cloud.root.rotation.y);
        for (let j = 0; j < cloud.emissionBases.length; j++) {
          const [x, y, z] = cloud.emissionBases[j];
          const sx = x * cloud.root.scale.x,
            sz = z * cloud.root.scale.z;
          cloud.emissionWorld[j * 3] =
            cloud.root.position.x + sx * cosine + sz * sine;
          cloud.emissionWorld[j * 3 + 1] =
            cloud.root.position.y + y * cloud.root.scale.y;
          cloud.emissionWorld[j * 3 + 2] =
            cloud.root.position.z - sx * sine + sz * cosine;
        }
      }
      rain.visible = wet && precipitationClouds.length > 0;
      snowfall.visible = condition === "snow" && precipitationClouds.length > 0;
      if (rain.visible) {
        const attribute = rain.geometry.attributes.position;
        rain.geometry.setDrawRange(0, rainVisual.particles * 2);
        for (let i = 0; i < rainVisual.particles; i++) {
          const s = rainSeeds[i],
            producer =
              precipitationClouds[s.cloudIndex % precipitationClouds.length],
            anchor =
              (i * 17 + Math.floor(s.phase * 15)) %
              producer.emissionBases.length,
            px = producer.emissionWorld[anchor * 3],
            pz = producer.emissionWorld[anchor * 3 + 2],
            top = producer.emissionWorld[anchor * 3 + 1] - 0.06,
            ground = heightAt(px, pz) + 0.1,
            span = Math.max(1.1, top - ground),
            fall = (elapsed * s.speed * rainVisual.speed + s.phase) % span,
            y = top - fall,
            windSlope = (weather.wind || 3) * 0.018,
            x = px + fall * windSlope,
            endY = Math.max(ground, y - rainVisual.streak);
          attribute.setXYZ(i * 2, x, y, pz);
          attribute.setXYZ(i * 2 + 1, x + (y - endY) * windSlope, endY, pz);
        }
        attribute.needsUpdate = true;
        rain.material.opacity = rainVisual.rainOpacity;
      }
      if (snowfall.visible) {
        const attribute = snowfall.geometry.attributes.position;
        for (let i = 0; i < snowSeeds.length; i++) {
          const s = snowSeeds[i],
            producer =
              precipitationClouds[s.cloudIndex % precipitationClouds.length],
            anchor =
              (i * 17 + Math.floor(s.phase * 15)) %
              producer.emissionBases.length,
            px = producer.emissionWorld[anchor * 3],
            pz = producer.emissionWorld[anchor * 3 + 2],
            top = producer.emissionWorld[anchor * 3 + 1],
            ground = heightAt(px, pz) + 0.1,
            span = Math.max(1.1, top - ground),
            fall = (elapsed * s.speed * 1.7 + s.phase) % span;
          attribute.setXYZ(
            i,
            px + fall * (weather.wind || 2) * 0.008,
            top - fall,
            pz,
          );
        }
        attribute.needsUpdate = true;
      }
      if (condition === "storm" && precipitationClouds.length && !stormArmed) {
        stormEpoch = elapsed;
        stormArmed = true;
      }
      const stormState = stormEffects.update(
        elapsed - stormEpoch,
        condition === "storm" && stormArmed,
        precipitationClouds,
        clouds,
      );
      const flash = stormState.flash > 0.015;
      host.dataset.lightning = String(flash);
      host.dataset.cloudFlash = stormState.cloudFlash.toFixed(3);
      stars.visible = night;
      if (night) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        stars.position.copy(camera.position).addScaledVector(direction, 65);
        stars.quaternion.copy(camera.quaternion);
      }
      stars.material.opacity = THREE.MathUtils.lerp(
        stars.material.opacity,
        night ? 0.8 : 0,
        alpha,
      );
      if (now - lastData > 500) {
        host.dataset.frames = String(frameCount);
        host.dataset.cameraAngle = controls.getAzimuthalAngle().toFixed(3);
        host.dataset.cameraPolar = controls.getPolarAngle().toFixed(3);
        host.dataset.animalsVisible = String(visibleAnimals);
        host.dataset.cloudsVisible = String(cloudsVisible);
        host.dataset.precipitationClouds = String(precipitationClouds.length);
        host.dataset.fishX = fish[0]?.group.position.x.toFixed(3);
        host.dataset.snow = uniforms.snow.value.toFixed(3);
        host.dataset.condition = condition;
        host.dataset.rain = String(rain.visible);
        host.dataset.rainParticles = String(rainVisual?.particles || 0);
        host.dataset.rainTexture = rainVisual?.texture || "none";
        host.dataset.rainThickness = String(rainVisual?.thickness || 0);
        host.dataset.snowfall = String(snowfall.visible);
        host.dataset.lightning = String(flash);
        host.dataset.animationTime = animals[0]?.mixer.time.toFixed(2);
        host.dataset.season = season;
        host.dataset.dayPhase = dayPhase;
        host.dataset.localHour = localHour.toFixed(2);
        host.dataset.autumn = uniforms.autumn.value.toFixed(3);
        host.dataset.snowman = String(snowman.visible);
        host.dataset.leaves = String(autumnLeaves.visible);
        lastData = now;
      }
    }
    controls.update();
    renderer.render(scene, camera);
    frameCount++;
  }
  frameHandle = requestAnimationFrame(animate);
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameHandle);
    abort.abort();
    observer.disconnect();
    controls.dispose();
    renderer.domElement.removeEventListener("keydown", keyControl);
    renderer.domElement.removeEventListener("webglcontextlost", lostContext);
    mixers.forEach((m) => {
      m.stopAllAction();
      m.uncacheRoot(m.getRoot());
    });
    const cloudTextures = new Set(
      clouds.flatMap((cloud) => Object.values(cloud.volumes)),
    );
    cloudTextures.forEach((texture) => texture.dispose());
    stormEffects.dispose();
    disposeObjects([scene, ...roots]);
    environmentTarget.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  return {
    setWeather,
    setEnvironment,
    setAutoRotate,
    reset,
    dispose,
    setSoundEnabled: stormEffects.setSoundEnabled,
    flashLightning: stormEffects.trigger,
  };
}
