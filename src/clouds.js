import * as THREE from "three";

export async function loadCloudVolumes(signal) {
  const response = await fetch("/assets/clouds/manifest.json", { signal });
  if (!response.ok) throw new Error("Cloud density manifest failed to load");
  const manifest = await response.json();
  const [width, height, depth] = manifest.dimensions;
  const entries = await Promise.all(
    Object.entries(manifest.fields).map(async ([name, field]) => {
      const result = await fetch(`/assets/clouds/${field.file}`, { signal });
      if (!result.ok) throw new Error(`Cloud density failed to load: ${name}`);
      const data = new Uint8Array(await result.arrayBuffer());
      if (data.length !== width * height * depth)
        throw new Error(`Incomplete cloud density: ${name}`);
      const texture = new THREE.Data3DTexture(data, width, height, depth);
      texture.format = THREE.RedFormat;
      texture.type = THREE.UnsignedByteType;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.unpackAlignment = 1;
      texture.userData.precipitationBases = field.precipitationBases;
      texture.needsUpdate = true;
      return [name, texture];
    }),
  );
  return Object.fromEntries(entries);
}

// The box only bounds the density field; its faces are never rendered as a
// surface. Integrating density yields soft silhouettes from every orbit angle.
export function createCloudVolume(texture, seed, sun) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uDensity: { value: texture },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0xffffff) },
      uShade: { value: new THREE.Color(0x8697ac) },
      uLocalRay: { value: new THREE.Vector3() },
      uLocalSun: { value: new THREE.Vector3(-0.3, 0.8, 0.4) },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uExtinction: { value: 9 },
      uFlash: { value: 0 },
      uFlashWorld: { value: new THREE.Vector3() },
      uFlashOrigin: { value: new THREE.Vector3() },
      uVolumeScale: { value: new THREE.Vector3(1, 1, 1) },
    },
    vertexShader: `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp sampler3D;
      uniform sampler3D uDensity;
      uniform float uOpacity, uTime, uSeed, uExtinction, uFlash;
      uniform vec3 uColor, uShade, uLocalRay, uLocalSun;
      uniform vec3 uFlashOrigin, uVolumeScale;
      varying vec3 vLocal;

      float density(vec3 p) {
        vec3 uv = p + 0.5;
        if (any(lessThan(uv, vec3(0.0))) || any(greaterThan(uv, vec3(1.0)))) return 0.0;
        // Very slow internal motion; the full 3D cloud still moves in world space.
        uv.x += sin(uv.y*12.0 + uTime*.075 + uSeed)*.009;
        uv.z += sin(uv.x*9.0 - uTime*.06 + uSeed)*.008;
        return texture(uDensity, uv).r;
      }
      void main() {
        vec3 ray = normalize(uLocalRay);
        vec3 origin = vLocal - ray*3.0;
        vec3 inverseRay = 1.0 / (ray + vec3(0.000001));
        vec3 a = (-vec3(.5)-origin)*inverseRay;
        vec3 b = ( vec3(.5)-origin)*inverseRay;
        vec3 entry = min(a,b), exitPoint = max(a,b);
        float nearT = max(max(entry.x,entry.y),entry.z);
        float farT = min(min(exitPoint.x,exitPoint.y),exitPoint.z);
        if (nearT >= farT) discard;
        float stepSize = (farT-nearT)/56.0;
        float jitter = fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        vec3 point = origin + ray*(nearT + stepSize*jitter);
        float transmittance = 1.0;
        vec3 radiance = vec3(0.0);
        for (int i=0; i<56; i++) {
          float d = density(point);
          if (d > .012) {
            float shadow = 0.0;
            vec3 lightPoint = point;
            for (int j=0; j<6; j++) {
              lightPoint += uLocalSun*.065;
              shadow += density(lightPoint)*.065;
            }
            float sunlight = exp(-shadow*11.0);
            float topLight = smoothstep(-.24,.28,point.y);
            float illumination = clamp(.12 + sunlight*.73 + topLight*.15,0.0,1.0);
            vec3 color = mix(uShade,uColor,illumination);
            vec3 flashDistance = (point-uFlashOrigin)*uVolumeScale;
            float internalGlow = exp(-dot(flashDistance,flashDistance)*.23);
            color += vec3(.95,1.25,1.75)*uFlash*internalGlow*(.25+d*.75);
            float absorption = 1.0-exp(-d*uExtinction*stepSize);
            radiance += transmittance*absorption*color;
            transmittance *= 1.0-absorption;
            if (transmittance < .012) break;
          }
          point += ray*stepSize;
        }
        float alpha = (1.0-transmittance)*uOpacity;
        if (alpha < .004) discard;
        gl_FragColor = vec4(radiance/max(1.0-transmittance,.001),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = "VolumetricCloud";
  const inverse = new THREE.Matrix4();
  const viewDirection = new THREE.Vector3();
  const lightDirection = new THREE.Vector3();
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    inverse.copy(mesh.matrixWorld).invert();
    material.uniforms.uFlashOrigin.value
      .copy(material.uniforms.uFlashWorld.value)
      .applyMatrix4(inverse);
    mesh.getWorldScale(material.uniforms.uVolumeScale.value);
    camera.getWorldDirection(viewDirection);
    material.uniforms.uLocalRay.value
      .copy(viewDirection)
      .transformDirection(inverse);
    lightDirection.copy(sun.position).normalize().transformDirection(inverse);
    material.uniforms.uLocalSun.value.copy(lightDirection);
  };
  return mesh;
}
