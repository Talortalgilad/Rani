import json,sys,re,collections
d=json.load(open('/home/user/Rani/dist/stats.json'))
nodes=d['nodeParts']; metas=d['nodeMetas']
# chunk membership: each nodeMeta has moduleParts {chunkFileName: partUid}
chunks=collections.defaultdict(lambda: collections.defaultdict(lambda:[0,0]))
for uid,m in metas.items():
    name=m['id']
    for chunk,partuid in m['moduleParts'].items():
        p=nodes[partuid]
        chunks[chunk][name][0]+=p['renderedLength']; chunks[chunk][name][1]+=p.get('gzipLength',0)
def group(name):
    n=name.replace('/home/user/Rani/','')
    m=re.search(r'node_modules/three/(.*)',n)
    if m:
        p=m.group(1)
        for key in ['src/renderers/webgl/','src/renderers/shaders/','src/renderers/','src/geometries/','src/materials/','src/lights/','src/cameras/','src/core/','src/math/','src/objects/','src/textures/','src/scenes/','src/loaders/','src/extras/','src/constants','src/utils','src/animation']:
            if key in p: return 'three: '+key.replace('src/','')
        return 'three: other'
    if 'node_modules' in n: return 'other lib: '+n.split('node_modules/')[-1].split('/')[0]
    return 'our code: '+n
for chunk,mods in sorted(chunks.items()):
    tot=sum(v[0] for v in mods.values()); gz=sum(v[1] for v in mods.values())
    if 'index' not in chunk and 'shapes' not in chunk and 'lobby' not in chunk and 'particles' not in chunk: continue
    print(f'\n=== {chunk}: {tot/1024:.1f} KB rendered, {gz/1024:.1f} KB gzip (module-level)')
    g=collections.defaultdict(lambda:[0,0,0])
    for n,v in mods.items():
        k=group(n); g[k][0]+=v[0]; g[k][1]+=v[1]; g[k][2]+=1
    for k,v in sorted(g.items(),key=lambda x:-x[1][0])[:14]:
        print(f'  {v[0]/1024:7.1f} KB  gz {v[1]/1024:6.1f} KB  ({v[2]:3d} modules)  {k}')
