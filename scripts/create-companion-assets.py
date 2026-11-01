"""Create the koi animation and retain the legacy cloud sculpt reference."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/models'

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

def material(name, color, roughness=.5, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return m

def sphere(name, at, scale, mat, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=at)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(mat)
    for polygon in o.data.polygons:
        polygon.use_smooth = True
    return o

def fin(name, verts, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [tuple(range(len(verts)))])
    mesh.materials.append(mat)
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    solid = o.modifiers.new('Fin thickness', 'SOLIDIFY')
    solid.thickness = .008
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.modifier_apply(modifier=solid.name)
    return o

clear()
orange = material('Koi warm vermilion', (1, .27, .055), .34, .03)
ivory = material('Koi pearl', (.96, .95, .84), .3, .04)
dark = material('Eyes', (.018, .025, .025), .16)
fin_mat = material('Fins amber', (1, .58, .25), .4)
body = sphere('KoiBody', (0, 0, 0), (.47, .135, .19), ivory, 36, 24)
colors = body.data.color_attributes.new(name='KoiColor', type='FLOAT_COLOR', domain='POINT')
for v in body.data.vertices:
    x, y, z = v.co
    spot = (math.sin(x * 18 + y * 23) + math.cos(x * 29 - z * 17)) > .35
    colors.data[v.index].color = (1, .25, .035, 1) if spot or x > .27 else (.97, .96, .88, 1)
nodes = ivory.node_tree.nodes
attr = nodes.new('ShaderNodeVertexColor')
attr.layer_name = 'KoiColor'
ivory.node_tree.links.new(attr.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
pieces = [body]
pieces.append(sphere('TailPeduncle', (-.43, 0, -.015), (.16, .06, .085), orange))
pieces.append(fin('TailUpper', [(-.52, 0, -.02), (-.78, .01, .24), (-.71, 0, 0), (-.78, -.01, -.2)], fin_mat))
pieces.append(fin('DorsalFin', [(-.25, 0, .13), (-.12, 0, .32), (.2, 0, .16)], fin_mat))
for sign in [-1, 1]:
    pieces.append(fin('PectoralFin', [( .18, sign * .09, -.03), (-.08, sign * .35, -.08), (-.16, sign * .1, -.12)], fin_mat))
    pieces.append(sphere('Eye', (.31, sign * .115, .055), (.035, .022, .035), dark, 16, 10))
bpy.ops.object.select_all(action='DESELECT')
for o in pieces:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'Koi'
bpy.ops.object.armature_add(location=(0, 0, 0))
rig = bpy.context.object
rig.name = 'KoiSwimRig'
bpy.ops.object.mode_set(mode='EDIT')
bone = rig.data.edit_bones[0]
bone.name = 'Body'
bone.head, bone.tail = (-.15, 0, 0), (.35, 0, 0)
tail = rig.data.edit_bones.new('Tail')
tail.head, tail.tail, tail.parent = (-.15, 0, 0), (-.48, 0, 0), bone
tip = rig.data.edit_bones.new('TailTip')
tip.head, tip.tail, tip.parent = (-.48, 0, 0), (-.78, 0, 0), tail
bpy.ops.object.mode_set(mode='OBJECT')
groups = {name: body.vertex_groups.new(name=name) for name in ['Body', 'Tail', 'TailTip']}
for v in body.data.vertices:
    x = v.co.x
    w = max(0, min(1, (-x - .13) / .34))
    tip_weight = max(0, min(1, (-x - .44) / .2))
    groups['Body'].add([v.index], max(.001, 1 - w), 'REPLACE')
    groups['Tail'].add([v.index], max(.001, w * (1 - tip_weight)), 'REPLACE')
    groups['TailTip'].add([v.index], max(.001, tip_weight), 'REPLACE')
body.parent = rig
mod = body.modifiers.new('Swim deformation', 'ARMATURE')
mod.object = rig
for pose_bone in rig.pose.bones:
    pose_bone.rotation_mode = 'XYZ'
for frame in range(1, 50):
    phase = (frame - 1) / 48 * math.tau
    for name, angle in [('Body', math.sin(phase) * .035), ('Tail', math.sin(phase) * .22), ('TailTip', math.sin(phase - .5) * .4)]:
        bone = rig.pose.bones[name]
        bone.rotation_euler.z = angle
        bone.keyframe_insert(data_path='rotation_euler', frame=frame)
rig.animation_data.action.name = 'Swim'
bpy.context.scene.render.fps = 24
bpy.context.scene.frame_end = 49
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/koi-swim.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'fish.glb'), export_format='GLB', export_animations=True, export_animation_mode='ACTIONS')

clear()
cloud_mat = material('Soft cloud porcelain', (.98, .99, 1), .98)
meta = bpy.data.metaballs.new('Cloud volume')
meta.resolution = .12
meta.render_resolution = .1
meta.threshold = .65
cloud = bpy.data.objects.new('Cloud', meta)
bpy.context.collection.objects.link(cloud)
for co, radius in [((-.8, 0, .03), .72), ((-.3, .03, .29), .94), ((.3, -.03, .36), 1.03), ((.9, 0, .08), .72), ((.28, .45, .1), .76), ((-.45, .37, 0), .7)]:
    e = meta.elements.new()
    e.co = co
    e.radius = radius
cloud.data.materials.append(cloud_mat)
bpy.context.view_layer.objects.active = cloud
cloud.select_set(True)
bpy.ops.object.convert(target='MESH')
cloud = bpy.context.object
for p in cloud.data.polygons:
    p.use_smooth = True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/cloud.blend'), compress=True)
# This legacy sculpt is retained only as a visual reference. Runtime weather
# clouds use the density fields produced by scripts/create-cloud-volumes.py.

# Keep the source 4K cottage and export a web-size texture copy.
clear()
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'assets/tripo-originals/cottage-tripo.glb'))
for image in bpy.data.images:
    if image.size[0] > 2048:
        image.scale(2048, 2048)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets/cottage.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'cottage.glb'), export_format='GLB', export_animations=False)
print('COMPANION_ASSETS_READY')
