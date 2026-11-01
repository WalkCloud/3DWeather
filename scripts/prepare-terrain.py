"""Inspect/prepare the real Tripo landscape for Three.js. Run with Blender."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/models'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/tripo-originals/terrain-tripo.glb'))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
vertices, polygons = [], []
for obj in meshes:
    start = len(vertices)
    vertices.extend([obj.matrix_world @ v.co for v in obj.data.vertices])
    polygons.extend([tuple(start + i for i in face.vertices) for face in obj.data.polygons])
bvh = BVHTree.FromPolygons(vertices, polygons, all_triangles=True)
N = 129
heights = []
for row in range(N):
    glb_z = -0.5 + row / (N - 1)
    for col in range(N):
        x = -0.5 + col / (N - 1)
        hit, normal, index, distance = bvh.ray_cast(Vector((x, -glb_z, 1.5)), Vector((0, 0, -1)), 3)
        heights.append(round(hit.z, 5) if hit else None)
(ROOT / 'public/assets/terrain-heights.json').write_text(json.dumps({'size': N, 'extent': 0.5, 'heights': heights}, separators=(',', ':')))

# The top view provides a reproducible coordinate reference for the house/pond.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.render.resolution_x = scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.world.color = (0.8, 0.8, 0.8)
scene.world.use_nodes = True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value = (0.8, 0.85, 0.9, 1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value = 0.65
bpy.ops.object.light_add(type='AREA', location=(-2, -2, 4))
bpy.context.object.data.energy = 150
bpy.context.object.data.shape = 'DISK'
bpy.context.object.data.size = 3
bpy.ops.object.camera_add(location=(0, 0, 2.5))
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.12
camera.rotation_euler = (0, 0, 0)
scene.camera = camera
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(ROOT / 'docs/tripo/terrain-top.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/terrain-layout.blend'), compress=True)
bpy.ops.render.render(write_still=True)
print('TERRAIN_HEIGHTS_READY', len(heights))

# A smaller texture set is sufficient for an entire miniature in a web viewport.
for image in bpy.data.images:
    if image.size[0] > 2048:
        image.scale(2048, 2048)
for o in bpy.context.selected_objects:
    o.select_set(False)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.export_scene.gltf(filepath=str(OUT / 'terrain.glb'), export_format='GLB', use_selection=True, export_animations=False)
print('TERRAIN_RUNTIME_READY')
