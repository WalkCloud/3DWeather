"""Rebuild the archived solid-cloud experiment (not used by the webpage)."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/cloud-mesh-archive"
OUT.mkdir(parents=True, exist_ok=True)


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def material(name):
    item = bpy.data.materials.new(name)
    item.use_nodes = True
    item.diffuse_color = (1, 1, 1, 1)
    bsdf = item.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (1, 1, 1, 1)
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Metallic"].default_value = 0
    color_attribute = item.node_tree.nodes.new("ShaderNodeVertexColor")
    color_attribute.layer_name = "Col"
    item.node_tree.links.new(
        color_attribute.outputs["Color"], bsdf.inputs["Base Color"]
    )
    return item


def paint_vertical_gradient(mesh, top, bottom):
    """Bake a soft top-light/bottom-shadow gradient into COLOR_0."""
    attribute = mesh.data.color_attributes.new(
        "Col", "BYTE_COLOR", "CORNER"
    )
    y_values = [vertex.co.y for vertex in mesh.data.vertices]
    low, high = min(y_values), max(y_values)
    top_color = Vector(top)
    bottom_color = Vector(bottom)
    for polygon in mesh.data.polygons:
        for loop_index in polygon.loop_indices:
            loop = mesh.data.loops[loop_index]
            vertex = mesh.data.vertices[loop.vertex_index]
            amount = (vertex.co.y - low) / max(0.0001, high - low)
            color = bottom_color.lerp(top_color, amount)
            attribute.data[loop_index].color = (color.x, color.y, color.z, 1)


def cloud(name, puffs, top, bottom, resolution=0.075):
    clear()
    meta = bpy.data.metaballs.new(f"{name} volume")
    meta.resolution = resolution
    meta.render_resolution = resolution * 0.82
    meta.threshold = 0.58
    target = bpy.data.objects.new(name, meta)
    bpy.context.collection.objects.link(target)
    for at, radius, scale in puffs:
        element = meta.elements.new()
        element.co = Vector(at)
        element.radius = radius
        element.size_x, element.size_y, element.size_z = scale
    target.data.materials.append(material(f"{name} porcelain"))
    bpy.context.view_layer.objects.active = target
    target.select_set(True)
    bpy.ops.object.convert(target="MESH")
    result = bpy.context.object
    result.name = name
    for polygon in result.data.polygons:
        polygon.use_smooth = True
    paint_vertical_gradient(result, top, bottom)
    return result


def export(result, filename, blend_name):
    bpy.ops.wm.save_as_mainfile(
        filepath=str(ROOT / "assets" / blend_name), compress=True
    )
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / filename),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
    )


# Fair-weather cumulus: compact, bright, and softly rounded.
cumulus = cloud(
    "CumulusCloud",
    [
        ((-0.50, -0.035, 0.02), 0.20, (1.00, 0.66, 0.76)),
        ((-0.29, 0.020, -0.05), 0.26, (1.00, 0.80, 0.88)),
        ((-0.05, 0.090, 0.04), 0.32, (1.00, 1.00, 0.96)),
        ((0.23, 0.030, -0.03), 0.27, (1.00, 0.84, 0.88)),
        ((0.48, -0.030, 0.02), 0.19, (1.00, 0.68, 0.76)),
        ((-0.15, -0.070, 0.01), 0.16, (0.90, 0.48, 0.60)),
        ((0.22, -0.075, -0.01), 0.15, (0.88, 0.46, 0.58)),
    ],
    (1.00, 1.00, 1.00),
    (0.74, 0.80, 0.90),
)
export(cumulus, "cloud-cumulus.glb", "cloud-cumulus.blend")

# A separate, softer fair-weather companion. It is used sparingly so windy
# weather and overcast do not look like copies of the same object.
companion = cloud(
    "CompanionCloud",
    [
        ((-0.42, -0.020, -0.02), 0.21, (1.00, 0.62, 0.80)),
        ((-0.15, 0.040, 0.03), 0.29, (1.00, 0.86, 0.92)),
        ((0.16, 0.010, -0.03), 0.24, (1.00, 0.76, 0.84)),
        ((0.41, -0.040, 0.02), 0.18, (1.00, 0.62, 0.74)),
    ],
    (1.00, 1.00, 1.00),
    (0.77, 0.82, 0.91),
)
export(companion, "cloud-companion.glb", "cloud-companion.blend")

# Overcast stratus: broad, shallow, gently lobed, and much lighter than rain.
stratus = cloud(
    "StratusCloud",
    [
        ((-0.88, -0.025, -0.02), 0.19, (1.16, 0.38, 0.48)),
        ((-0.60, 0.030, 0.04), 0.25, (1.28, 0.50, 0.52)),
        ((-0.30, -0.010, -0.05), 0.29, (1.30, 0.46, 0.54)),
        ((-0.02, 0.055, 0.02), 0.31, (1.36, 0.58, 0.54)),
        ((0.29, 0.015, -0.04), 0.26, (1.28, 0.46, 0.52)),
        ((0.59, 0.045, 0.05), 0.22, (1.20, 0.48, 0.50)),
        ((0.86, -0.020, -0.02), 0.17, (1.12, 0.36, 0.46)),
        ((-0.47, -0.080, 0.01), 0.18, (1.05, 0.32, 0.44)),
        ((0.21, -0.085, -0.02), 0.17, (1.02, 0.30, 0.43)),
    ],
    (0.99, 1.00, 1.00),
    (0.66, 0.72, 0.82),
    resolution=0.062,
)
export(stratus, "cloud-stratus.glb", "cloud-stratus.blend")

# Rain cloud: thicker, lower, with a heavier underside and cooler gray tone.
rain = cloud(
    "RainCloud",
    [
        ((-0.72, -0.020, -0.01), 0.25, (1.20, 0.54, 0.58)),
        ((-0.42, 0.060, 0.03), 0.32, (1.24, 0.66, 0.62)),
        ((-0.10, 0.105, -0.03), 0.36, (1.30, 0.76, 0.64)),
        ((0.24, 0.045, 0.04), 0.31, (1.24, 0.64, 0.62)),
        ((0.56, -0.010, -0.02), 0.25, (1.16, 0.52, 0.58)),
        ((-0.28, -0.090, 0.01), 0.20, (1.02, 0.38, 0.50)),
        ((0.16, -0.095, 0), 0.19, (1.00, 0.36, 0.49)),
        ((0.45, -0.070, 0.03), 0.16, (0.96, 0.34, 0.47)),
    ],
    (0.87, 0.91, 0.97),
    (0.44, 0.49, 0.59),
    resolution=0.058,
)
export(rain, "cloud-rain.glb", "cloud-rain.blend")

print("CLOUD_ASSETS_READY")
