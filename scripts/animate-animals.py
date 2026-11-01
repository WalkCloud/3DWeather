"""Build editable, gently animated quadruped rigs from the matching Tripo meshes.

Canonical forward is +X, up is Blender +Z / glTF +Y. No external service is
needed to rebuild these animation clips.
"""
import bpy
import json
import math
import sys
import numpy as np
from pathlib import Path
from mathutils import Matrix, Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/models'
metadata_path = ROOT / 'assets/animation-metadata.json'
metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
species_names = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['cow','sheep','horse']

def smooth(a, b, value):
    t = max(0, min(1, (value-a)/(b-a)))
    return t*t*(3-2*t)

def add_bone(armature, name, head, tail, parent=None):
    bone = armature.data.edit_bones.new(name)
    bone.head, bone.tail = head, tail
    if parent:
        bone.parent = armature.data.edit_bones[parent]
    return bone

for species in species_names:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'assets/tripo-originals/{species}-tripo.glb'))
    mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    mesh.data.transform(mesh.matrix_world)
    mesh.parent = None
    mesh.matrix_world = Matrix.Identity(4)
    points = np.array([v.co[:] for v in mesh.data.vertices])
    center = points[:, :2].mean(axis=0)
    covariance = np.cov((points[:, :2]-center).T)
    values, vectors = np.linalg.eigh(covariance)
    forward = vectors[:, np.argmax(values)]
    along = (points[:, :2]-center) @ forward
    low, high = np.quantile(along, [.17, .83])
    # A grazing head is lower than the rump, allowing all three source poses
    # to be aligned without baking a camera-dependent orientation.
    if np.median(points[along > high, 2]) > np.median(points[along < low, 2]):
        forward = -forward
    # The verified chestnut source has a low tail tip, which reverses the
    # median-height heuristic. Correct its orientation before weighting.
    if species == 'horse':
        forward = -forward
    rotation = Matrix.Rotation(-math.atan2(forward[1], forward[0]), 4, 'Z')
    mesh.data.transform(rotation)
    points = np.array([v.co[:] for v in mesh.data.vertices])
    minimum, maximum = points.min(axis=0), points.max(axis=0)
    offset = Vector((-(minimum[0]+maximum[0])/2, -(minimum[1]+maximum[1])/2, -minimum[2]))
    mesh.data.transform(Matrix.Translation(offset))
    points += np.array(offset)
    minimum, maximum = points.min(axis=0), points.max(axis=0)
    length, width, height = maximum-minimum
    mesh.name = f'{species.title()}Mesh'
    bpy.ops.object.armature_add(location=(0,0,0))
    rig = bpy.context.object
    rig.name = f'{species.title()}Rig'
    rig.show_in_front = True
    bpy.ops.object.mode_set(mode='EDIT')
    rig.data.edit_bones.remove(rig.data.edit_bones[0])
    add_bone(rig,'Root',(0,0,.03*height),(0,0,.2*height))
    add_bone(rig,'Torso',(-.22*length,0,.56*height),(.12*length,0,.6*height),'Root')
    add_bone(rig,'Neck',(.08*length,0,.62*height),(.28*length,0,.5*height),'Torso')
    add_bone(rig,'Head',(.28*length,0,.5*height),(.45*length,0,.3*height),'Neck')
    add_bone(rig,'Tail',(-.34*length,0,.56*height),(-.49*length,0,.34*height),'Torso')
    hoof_positions = {}
    for fore in [True,False]:
        for side in [1,-1]:
            name = ('Fore' if fore else 'Hind') + ('L' if side>0 else 'R')
            mask = (points[:,2] < height*.18) & (points[:,0] < length*.3) & (points[:,0] > -length*.42)
            mask &= (points[:,0] > -length*.04) if fore else (points[:,0] <= -length*.04)
            mask &= (points[:,1] > width*.045) if side>0 else (points[:,1] < -width*.045)
            if mask.sum()>4:
                foot = np.median(points[mask],axis=0)
            else:
                foot = np.array([length*(.14 if fore else -.25),side*width*.3,height*.045])
            x,y = float(foot[0]),float(foot[1])
            hip = (x+(-.02 if fore else .02)*length,y,height*.54)
            knee = (x+(.025 if fore else -.025)*length,y,height*.28)
            hoof = (x,y,height*.025)
            add_bone(rig,name+'Upper',hip,knee,'Torso')
            add_bone(rig,name+'Lower',knee,hoof,name+'Upper')
            hoof_positions[name] = [x,y]
    bpy.ops.object.mode_set(mode='OBJECT')
    groups = {b.name: mesh.vertex_groups.new(name=b.name) for b in rig.data.bones}
    for v in mesh.data.vertices:
        x,y,z = v.co
        head_weight = smooth(.13*length,.36*length,x)
        if x > .01*length and z > .62*height:
            head_weight = max(head_weight,.55*smooth(.01*length,.2*length,x))
        weights = {'Torso':1}
        if head_weight > .05:
            head_part = smooth(.24*length,.4*length,x)
            weights = {'Torso':1-head_weight,'Neck':head_weight*(1-head_part),'Head':head_weight*head_part}
        elif z < .58*height:
            best = min(hoof_positions, key=lambda name:(x-hoof_positions[name][0])**2+(y-hoof_positions[name][1])**2)
            leg_weight = 1-smooth(.38*height,.57*height,z)
            lower = 1-smooth(.19*height,.35*height,z)
            weights = {'Torso':1-leg_weight,best+'Upper':leg_weight*(1-lower),best+'Lower':leg_weight*lower}
        if x < -.42*length and abs(y)<width*.2 and z>.12*height:
            tail_weight = smooth(.4*length,.49*length,-x)*.7
            weights = {'Torso':1-tail_weight,'Tail':tail_weight}
        for name,weight in weights.items():
            if weight>.001:
                groups[name].add([v.index],weight,'REPLACE')
    mesh.parent = rig
    deform = mesh.modifiers.new('Quadruped skin', 'ARMATURE')
    deform.object = rig
    rig.animation_data_create()
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    def rotate_world(name, axis, angle):
        pb = rig.pose.bones[name]
        local_axis = pb.bone.matrix_local.to_3x3().inverted() @ Vector(axis)
        pb.rotation_quaternion = Quaternion(local_axis.normalized(),angle)

    actions = []
    for clip,frames in [('Graze',97),('Walk',49)]:
        rig.animation_data.action = None
        for frame in range(1,frames+1):
            phase = (frame-1)/(frames-1)*math.tau
            for pb in rig.pose.bones:
                pb.rotation_quaternion = Quaternion((1,0,0,0))
                pb.location = (0,0,0)
                pb.scale = (1,1,1)
            if clip=='Graze':
                rotate_world('Neck',(0,1,0),.035*math.sin(phase))
                rotate_world('Head',(0,1,0),.055*math.sin(phase*2+.3))
                rotate_world('Tail',(0,0,1),.09*math.sin(phase*2))
                rig.pose.bones['Torso'].scale = (1+.004*math.sin(phase),1,1+.005*math.sin(phase))
            else:
                amplitude = .19 if species=='sheep' else .24
                for name in hoof_positions:
                    stagger = 0 if name in ['ForeL','HindR'] else math.pi
                    swing = math.sin(phase+stagger)
                    rotate_world(name+'Upper',(0,1,0),amplitude*swing)
                    rotate_world(name+'Lower',(0,1,0),-.16*max(0,swing)+.025)
                rotate_world('Head',(0,1,0),.025*math.sin(phase))
                rotate_world('Tail',(0,0,1),.1*math.sin(phase))
                rig.pose.bones['Root'].location.z = height*.008*(1-math.cos(phase*2))
            for pb in rig.pose.bones:
                pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
                pb.keyframe_insert(data_path='location',frame=frame)
                if pb.name=='Torso': pb.keyframe_insert(data_path='scale',frame=frame)
        action = rig.animation_data.action
        action.name = clip
        action.use_fake_user = True
        actions.append(action)
    rig.animation_data.action = actions[0]
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.frame_end = 97
    scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / f'assets/{species}-animation.blend'),compress=True)
    # Keep editable sources at source resolution; distant web animals need 1K maps.
    for image in bpy.data.images:
        if image.size[0] > 1024:
            image.scale(1024,1024)
            image.pack()
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{species}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS')
    metadata[species]={'bounds':{'min':minimum.tolist(),'max':maximum.tolist()},'forward':'+X','clips':{'Graze':4,'Walk':2},'boneCount':len(rig.data.bones),'hoofPositions':hoof_positions}
    print('ANIMAL_READY',species,len(mesh.data.vertices),len(rig.data.bones))
(ROOT/'assets/animation-metadata.json').write_text(json.dumps(metadata,indent=2))
