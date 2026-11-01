"""Bake deterministic cloud density fields. Run with Blender's bundled Python.

Density, not a solid surface, defines each cloud. All three fields share a softly
flattened base, with different upper billows and five scales of turbulent erosion.
The X axis is fastest, matching WebGL's Data3DTexture memory layout.
"""
from pathlib import Path
import json
import numpy as np
import bpy
import openvdb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/clouds"
OUT.mkdir(parents=True, exist_ok=True)
SOURCES = ROOT / "assets/cloud-volumes"
SOURCES.mkdir(parents=True, exist_ok=True)
SIZE = (96, 64, 64)
z, y, x = np.meshgrid(
    np.linspace(-0.5, 0.5, SIZE[2], dtype=np.float32),
    np.linspace(-0.5, 0.5, SIZE[1], dtype=np.float32),
    np.linspace(-0.5, 0.5, SIZE[0], dtype=np.float32), indexing="ij"
)


def smoothstep(a, b, v):
    t = np.clip((v - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def noise(px, py, pz, frequency, seed):
    rng = np.random.default_rng(seed)
    grid = rng.random((int(np.ceil(frequency * 1.2)) + 4,) * 3).astype(np.float32)
    coordinates = [(p + 0.6) * frequency for p in (px, py, pz)]
    indices = [np.floor(c).astype(np.int32) for c in coordinates]
    blend = [smoothstep(0, 1, c - i) for c, i in zip(coordinates, indices)]
    result = np.zeros_like(px)
    for dz in range(2):
        for dy in range(2):
            for dx in range(2):
                weight = ((blend[0] if dx else 1-blend[0]) *
                          (blend[1] if dy else 1-blend[1]) *
                          (blend[2] if dz else 1-blend[2]))
                result += grid[indices[2]+dz, indices[1]+dy, indices[0]+dx] * weight
    return result


def field(seed, kind):
    # Domain warping prevents the lobes reading as a row of identical spheres.
    warp = noise(x, y, z, 4, seed + 99) - 0.5
    px, py, pz = x + warp*0.055, y + warp*0.065, z + warp*0.06
    hull = np.full_like(x, -10)
    # A continuous, broad bottom connects the upper cauliflower-shaped turrets.
    lobes = [(-.01, -.14, 0, .41, .13, .29),
             (-.29, -.055, -.03, .15, .17, .21),
             (-.14, .065, -.05, .17, .27, .23),
             (.065, .035, .03, .16, .23, .22),
             (.265, -.015, -.02, .18, .19, .20),
             (-.13, -.055, .19, .18, .17, .17),
             (.19, -.05, -.18, .16, .17, .17),
             (-.04,.20,-.07,.13,.17,.17)]
    if kind == "stratus":
        lobes = [(cx, cy*.85, cz, rx, ry*.9, rz*1.1) for cx,cy,cz,rx,ry,rz in lobes]
    if kind == "rainLight":
        lobes = [(-.01,-.12,0,.42,.12,.33),
                 (-.27,-.04,-.03,.18,.14,.25),
                 (-.07,.015,.035,.23,.18,.29),
                 (.20,-.025,-.02,.23,.15,.26),
                 (-.08,-.06,.18,.23,.12,.17)]
    if kind == "rainModerate":
        lobes = [(-.01,-.13,0,.43,.14,.34),
                 (-.27,-.015,-.03,.19,.19,.27),
                 (-.07,.045,-.02,.24,.24,.30),
                 (.19,.01,.04,.23,.21,.27),
                 (-.10,-.04,.19,.22,.17,.20),
                 (.22,-.055,-.18,.20,.17,.20)]
    if kind == "rain":
        lobes += [(.02, .20, -.02, .22, .21, .24), (-.23, .11, .08, .18, .24, .22)]
    for cx, cy, cz, rx, ry, rz in lobes:
        distance = 1 - np.sqrt(((px-cx)/rx)**2 + ((py-cy)/ry)**2 + ((pz-cz)/rz)**2)
        # Smooth union without small detached bubbles.
        k = .11
        h = np.clip(.5 + .5*(hull-distance)/k, 0, 1)
        hull = distance*(1-h) + hull*h + k*h*(1-h)
    turbulence = sum(weight * (noise(x,y,z,frequency,seed+frequency)-.5)
                     for frequency,weight in [(5,.52),(11,.28),(23,.14),(47,.06)])
    density = smoothstep(.0, .18, hull + turbulence*.95 - .04)
    # Fine erosion is strongest around the perimeter, leaving a coherent core.
    fine = noise(x,y,z,61,seed+407)
    density *= smoothstep(.16, .66, fine + density*.36)
    density *= smoothstep(-.30, -.18, y)
    density *= 1-smoothstep(.40,.47,np.maximum.reduce([np.abs(x),np.abs(y),np.abs(z)]))
    density = np.clip(density*.91,0,1)
    return np.rint(density*255).astype(np.uint8)


manifest = {"dimensions": list(SIZE), "format": "r8", "layout": "zyx-x-fastest", "fields": {}}
for kind,seed in [("cumulus",74),("stratus",174),("rain",274),("rainLight",374),("rainModerate",474)]:
    data = field(seed,kind)
    filename = f"{kind}.density.bin"
    (OUT/filename).write_bytes(data.tobytes())
    grid = openvdb.FloatGrid()
    grid.name = "density"
    grid.copyFromArray(np.ascontiguousarray(data.transpose(2,1,0), dtype=np.float32)/255)
    vdb_path = SOURCES / f"{kind}.vdb"
    openvdb.write(str(vdb_path), grids=[grid])
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.object.volume_import(filepath=str(vdb_path))
    volume = bpy.context.object
    volume.name = f"{kind.title()} density volume"
    volume.scale = tuple(1/value for value in SIZE)
    volume.location = (-.5,-.5,-.5)
    volume.data.filepath = f"//{kind}.vdb"
    material = bpy.data.materials.new(f"{kind} cloud scattering")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    scattering = nodes.new("ShaderNodeVolumePrincipled")
    scattering.inputs["Density"].default_value = 8
    scattering.inputs["Density Attribute"].default_value = "density"
    scattering.inputs["Color"].default_value = (.95,.97,1,1)
    scattering.inputs["Anisotropy"].default_value = .15
    material.node_tree.links.new(scattering.outputs["Volume"],output.inputs["Volume"])
    volume.data.materials.append(material)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES/f"{kind}.blend"),compress=True)
    # Spawn precipitation only under dense columns, at their lowest cloud voxel.
    columns = np.argwhere((data > 80).sum(axis=1) > 6)
    anchors = []
    for iz,ix in columns[::max(1,len(columns)//128)][:128]:
        iy = int(np.flatnonzero(data[iz,:,ix] > 35)[0])
        anchors.append([round(float(ix/(SIZE[0]-1)-.5),5),
                        round(float(iy/(SIZE[1]-1)-.5),5),
                        round(float(iz/(SIZE[2]-1)-.5),5)])
    manifest["fields"][kind] = {"file": filename, "bytes": data.nbytes,
        "occupiedFraction": round(float(np.mean(data>0)),5), "seed":seed,
        "precipitationBases": anchors}
    print(kind, "bytes", data.nbytes, "bases", len(anchors))
(OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("CLOUD_DENSITY_READY")
