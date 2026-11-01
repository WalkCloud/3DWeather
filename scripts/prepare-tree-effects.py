"""Extract real canopy emitters and bare ground from the retained Tripo terrain; export an editable leaf. Run with Blender."""
import bpy,json,math,hashlib,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/assets/models/terrain.glb'))
o=next(o for o in bpy.context.scene.objects if o.type=='MESH')
verts=[o.matrix_world@v.co for v in o.data.vertices];faces=[tuple(p.vertices) for p in o.data.polygons]
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True)
# The image feeding Base Color, rather than a normal/roughness texture.
bsdf=next(n for n in o.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
node=bsdf.inputs['Base Color'].links[0].from_node
image=node.image
pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels);pixels=pixels.reshape(image.size[1],image.size[0],4)
uv=o.data.uv_layers.active.data
N=161;top=np.full((N,N),np.nan);ground=np.full((N,N),np.nan);mask=np.zeros((N,N),bool);points={};normals={}
for iz in range(N):
 z=-.5+iz/(N-1)
 for ix in range(N):
  x=-.5+ix/(N-1);origin=Vector((x,-z,1.0));hits=[]
  for j in range(24):
   p,n,idx,dist=bvh.ray_cast(origin,Vector((0,0,-1)),2)
   if p is None:break
   hits.append((p.copy(),n.copy(),idx));origin=p-Vector((0,0,.00005))
  if not hits:continue
  top[iz,ix]=hits[0][0].z
  candidates=[p.z for p,n,idx in hits if n.z>.18 and p.z>.018]
  ground[iz,ix]=min(candidates) if candidates else hits[-1][0].z
  p,n,idx=hits[0]
  face=o.data.polygons[idx];ids=face.vertices
  uvs=[uv[j].uv for j in face.loop_indices]
  tex=barycentric_transform(p,*(verts[k] for k in ids),*(Vector((t.x,t.y,0)) for t in uvs))
  px=int(tex.x*(image.size[0]-1))%image.size[0];py=int(tex.y*(image.size[1]-1))%image.size[1]
  r,g,b=pixels[py,px,:3]
  green=g>r*.90 and g>b*1.18
  if (p.z-ground[iz,ix])*18 > .85 and green:
   mask[iz,ix]=True;points[(iz,ix)]=p;normals[(iz,ix)]=n
visited=set();clusters=[];trees=[]
for iz,ix in zip(*np.nonzero(mask)):
 if (iz,ix) in visited:continue
 stack=[(iz,ix)];visited.add((iz,ix));group=[]
 while stack:
  a,b=stack.pop();group.append((a,b))
  for dz in [-1,0,1]:
   for dx in [-1,0,1]:
    q=(a+dz,b+dx)
    if 0<=q[0]<N and 0<=q[1]<N and mask[q] and q not in visited:visited.add(q);stack.append(q)
 if len(group)<45:continue
 heights=[(top[q]-ground[q])*18 for q in group]
 if max(heights)<1.35:continue
 cx=sum((-0.5+q[1]/(N-1))*18 for q in group)/len(group);cz=sum((-0.5+q[0]/(N-1))*15 for q in group)/len(group)
 ys=[float(points[q].z*18) for q in group]
 edge=[q for q in group if any((q[0]+dz,q[1]+dx) not in group for dz,dx in [(1,0),(-1,0),(0,1),(0,-1)]) and points[q].z*18 <= float(np.quantile(ys,.80))]
 if not edge:edge=group
 emitter_points=[]
 for j in np.linspace(0,len(edge)-1,min(24,len(edge)),dtype=int):
  q=edge[j];p=points[q];n=normals[q]
  emitter_points.append([round(float(p.x*18+n.x*.015),5),round(float(p.z*18+n.z*.015),5),round(float(-p.y*15-n.y*.015),5)])
 trees.append({'id':f'tree-{len(trees)+1}', 'center':[round(float(cx),5),round(float(cz),5)],
  'crownY':[round(min(ys),5),round(max(ys),5)], 'height':round(float(max(heights)),5),'canopyCells':len(group),
  'emitters':emitter_points})
 print('TREE',trees[-1]['id'],trees[-1]['center'],'emitters',len(emitter_points))
public=ROOT/'public/assets'
(public/'tree-anchors.json').write_text(json.dumps({'source':'models/terrain.glb','sourceSha256':hashlib.sha256((public/'models/terrain.glb').read_bytes()).hexdigest(),'coordinates':'Three.js world Y-up; scale 18,18,15', 'trees':trees},indent=2)+'\n')
(public/'terrain-ground-heights.json').write_text(json.dumps({'size':N,'extent':.5,'heights':[round(float(v),5) if np.isfinite(v) else None for v in ground.ravel()]},separators=(',',':')))
# A small folded almond leaf with a raised central vein, lying in Blender XY.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
leaf_verts=[(0,0,.035)]+[(.29*math.sin(t)*(1-.15*math.cos(t)),.5*math.cos(t),-.015+abs(math.sin(t))*.018) for t in np.linspace(0,math.tau,24,endpoint=False)]
leaf_faces=[(0,1+j,1+(j+1)%24) for j in range(24)]
mesh=bpy.data.meshes.new('Folded leaf');mesh.from_pydata(leaf_verts,[],leaf_faces);mesh.update()
leaf=bpy.data.objects.new('Autumn leaf',mesh);bpy.context.collection.objects.link(leaf);leaf.select_set(True);bpy.context.view_layer.objects.active=leaf
mat=bpy.data.materials.new('Leaf warm ochre');mat.diffuse_color=(1,.85,.55,1);mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(1,.85,.55,1);bsdf.inputs['Roughness'].default_value=.94
leaf.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/autumn-leaf.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(public/'models/autumn-leaf.glb'),export_format='GLB',use_selection=True,export_animations=False)
print('TREE_EFFECTS_READY',len(trees))
# Debug top view; green clusters and red source mask rendered over gray height.
rgba=np.zeros((N,N,4),np.float32);rgba[:,:,3]=1;rgba[:,:,:3]=np.nan_to_num(top[:,:,None],nan=0)*2
rgba[mask,:3]=(.8,.1,.01)
im=bpy.data.images.new('canopy scan',width=N,height=N);im.pixels.foreach_set(rgba.ravel());im.scale(966,966)
im.filepath_raw=str(ROOT/'docs/qa/tree-canopy-source-map.png');im.file_format='PNG';im.save()
