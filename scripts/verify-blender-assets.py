"""Open the delivered Blender sources and verify real, looping mesh deformation.

This reads the .blend files without saving changes. It writes only a QA report.
Run with Blender --background --python scripts/verify-blender-assets.py.
"""
import bpy
import json
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "cottage.blend": [],
    "terrain-layout.blend": [],
    "cloud.blend": [],
    "cow-animation.blend": ["Graze", "Walk"],
    "sheep-animation.blend": ["Graze", "Walk"],
    "horse-animation.blend": ["Graze", "Walk"],
    "koi-swim.blend": ["Swim"],
}


def vertices_at(meshes, frame):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    samples = []
    for source in meshes:
        evaluated = source.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
            mesh.vertices.foreach_get("co", positions)
            samples.append(positions.reshape(-1, 3))
        finally:
            evaluated.to_mesh_clear()
    return np.concatenate(samples)


report = {"blenderVersion": bpy.app.version_string, "sources": {}}
for filename, required_clips in SOURCES.items():
    path = ROOT / "assets" / filename
    bpy.ops.wm.open_mainfile(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert meshes, f"{filename}: no mesh"
    missing = [
        image.name
        for image in bpy.data.images
        if image.source == "FILE"
        and not image.packed_file
        and not Path(bpy.path.abspath(image.filepath)).is_file()
    ]
    assert not missing, f"{filename}: missing textures {missing}"
    item = {
        "bytes": path.stat().st_size,
        "meshCount": len(meshes),
        "vertexCount": sum(len(mesh.data.vertices) for mesh in meshes),
        "missingTextures": missing,
        "clips": {},
    }
    if required_clips:
        rigs = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
        assert len(rigs) == 1, f"{filename}: expected one rig"
        rig = rigs[0]
        item["boneCount"] = len(rig.data.bones)
        for name in required_clips:
            action = bpy.data.actions.get(name)
            assert action is not None, f"{filename}: missing {name}"
            rig.animation_data.action = action
            start, end = map(round, action.frame_range)
            quarter = round(start + (end - start) / 4)
            first = vertices_at(meshes, start)
            middle = vertices_at(meshes, quarter)
            last = vertices_at(meshes, end)
            displacement = float(np.linalg.norm(middle - first, axis=1).max())
            seam = float(np.linalg.norm(last - first, axis=1).max())
            assert displacement > 1e-5, f"{filename} {name}: mesh did not deform"
            assert seam < 1e-4, f"{filename} {name}: discontinuous loop ({seam})"
            item["clips"][name] = {
                "frames": [start, end],
                "durationSeconds": (end - start) / bpy.context.scene.render.fps,
                "sampleFrame": quarter,
                "maximumVertexDisplacement": displacement,
                "loopSeamDisplacement": seam,
            }
    report["sources"][filename] = item

report["result"] = "passed"
destination = ROOT / "docs" / "qa" / "blender-assets.json"
destination.write_text(json.dumps(report, indent=2) + "\n")
print("BLENDER_ASSETS_VERIFIED", json.dumps(report, separators=(",", ":")))
