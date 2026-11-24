"""Corps de la Bouille (une seule pièce) → public/models/bouille-body.glb

Lancer : python -m pip install bpy==5.3.0 ; python tools/blender/build_body.py -- public/models
Repère Blender : Z vers le haut, la Bouille regarde vers -Y ; 1 unité = 62 px du dessin 2D.
Le haut du cou est à z = 0 (le site place la tête au-dessus). Formes : Grandeur+/-, Carrure+/-.
UV : face avant du corps sur u ∈ [0, 0.5], dos sur u ∈ [0.5, 1] (feuilles de peinture « corps » et « dos »).
"""
import bpy, bmesh, sys, os, json

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '.'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# Cadre des feuilles de peinture du corps (repère Blender, pose de base)
BOX = {'x0': -1.0, 'x1': 1.0, 'z0': -3.15, 'z1': 0.1}

def skeleton(hf, bw):
    """Points (position, rayons x/y) et liaisons. Le cou garde la même longueur quelle que soit la grandeur."""
    neck = 0.2
    tz = lambda d: -neck - d * hf
    P = {
        'neck_top': ((0, 0.03, 0.0), (0.19, 0.18)),
        'neck': ((0, 0.03, -neck), (0.21, 0.19)),
        'chest': ((0, 0.03, tz(0.32)), (0.52 * bw, 0.33 * bw)),
        'waist': ((0, 0.03, tz(0.85)), (0.5 * bw, 0.32 * bw)),
        'hip': ((0, 0.03, tz(1.08)), (0.5 * bw, 0.32 * bw)),
    }
    for sd, k in ((-1, 'L'), (1, 'R')):
        P['sh' + k] = ((sd * 0.56 * bw, 0.03, tz(0.16)), (0.2 * bw, 0.2 * bw))
        P['el' + k] = ((sd * 0.7 * bw, 0.03, tz(0.6)), (0.17 * bw, 0.17 * bw))
        P['wr' + k] = ((sd * 0.76 * bw, 0.03, tz(1.0)), (0.15 * bw, 0.15 * bw))
        P['ha' + k] = ((sd * 0.78 * bw, 0.0, tz(1.14)), (0.19, 0.16))
        P['th' + k] = ((sd * 0.25 * bw, 0.03, tz(1.22)), (0.23 * bw, 0.23 * bw))
        P['kn' + k] = ((sd * 0.25 * bw, 0.03, tz(1.62)), (0.2 * bw, 0.2 * bw))
        P['an' + k] = ((sd * 0.25 * bw, 0.03, tz(2.0)), (0.17 * bw, 0.17 * bw))
        P['to' + k] = ((sd * 0.26 * bw, -0.2, tz(2.08)), (0.19 * bw, 0.14))
    E = [('neck_top', 'neck'), ('neck', 'chest'), ('chest', 'waist'), ('waist', 'hip')]
    for k in 'LR':
        E += [('chest', 'sh' + k), ('sh' + k, 'el' + k), ('el' + k, 'wr' + k), ('wr' + k, 'ha' + k),
              ('hip', 'th' + k), ('th' + k, 'kn' + k), ('kn' + k, 'an' + k), ('an' + k, 'to' + k)]
    zones = {'neck': -neck + 0.02, 'waist': tz(0.9), 'wrist': tz(0.98), 'feet': tz(1.92), 'hand': 0.62 * bw, 'bottom': tz(2.2)}
    return P, E, zones

def build(name, hf, bw):
    P, E, zones = skeleton(hf, bw)
    names = list(P)
    me = bpy.data.meshes.new(name)
    me.from_pydata([P[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in E], [])
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    for o in scene.objects:
        o.select_set(o == ob)
    sk = ob.modifiers.new('skin', 'SKIN')
    for i, n in enumerate(names):
        me.skin_vertices[0].data[i].radius = P[n][1]
    me.skin_vertices[0].data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 2
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    return ob, zones

base, zones = build('Body', 1.0, 1.0)
bpy.context.view_layer.objects.active = base
NECK = 0.2
variants = {'tall': ('h', 1.48), 'short': ('h', 0.52), 'wide': ('w', 1.4), 'thin': ('w', 0.6)}
meta = {'zones': zones, 'box': BOX, 'neck': NECK, 'variants': {}}
base.shape_key_add(name='Basis')

def smooth01(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

for key, (kind, k) in variants.items():
    sk = base.shape_key_add(name=key)
    for i, v in enumerate(base.data.vertices):
        x, y, z = v.co
        # Le cou ne bouge pas ; le reste du corps s'allonge / s'élargit progressivement sous le cou
        f = smooth01((-z - NECK * 0.6) / (NECK * 0.8))
        if kind == 'h':
            z2 = z if z > -NECK else -NECK + (z + NECK) * k
            sk.data[i].co = (x, y, z + (z2 - z) * f)
        else:
            s_ = 1 + (k - 1) * f
            sk.data[i].co = (x * s_, 0.03 + (y - 0.03) * s_, z)
    meta['variants'][key] = {'bottom': (-NECK + (zones['bottom'] + NECK) * k) if kind == 'h' else zones['bottom']}
meta['bottom'] = zones['bottom']

# UV : projection plane, avant (normale vers -Y) à gauche, dos à droite
me = base.data
for p in me.polygons:
    p.use_smooth = True
uv = me.uv_layers.new(name='UVMap')
bw_ = BOX['x1'] - BOX['x0']
bh_ = BOX['z1'] - BOX['z0']
for p in me.polygons:
    back = p.normal.y > 0
    for li in p.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        u = (co.x - BOX['x0']) / bw_
        if back:
            u = 1 - u  # le dos vu de derrière
        v = (co.z - BOX['z0']) / bh_
        uv.data[li].uv = (u * 0.5 + (0.5 if back else 0), v)

mat = bpy.data.materials.new('Body')
me.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'bouille-body.glb'), export_format='GLB', use_selection=False,
                          export_morph=True, export_morph_normal=True, export_apply=False, export_yup=True,
                          export_materials='PLACEHOLDER', export_texcoords=True, export_normals=True)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'bouille', 'body-meta.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('verts', len(me.vertices), 'OK')
