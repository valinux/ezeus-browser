"""Static geometry checks, not a simulation of Zeus's walkers or appeal engine."""
from collections import deque
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
data = json.loads((HERE/'blueprint.json').read_text())
results = []

def tiles(b):
    return {(x,y) for x in range(b['x'],b['x']+b['w']) for y in range(b['y'],b['y']+b['h'])}

for mode, plans in data['plans'].items():
    for key,p in plans.items():
        errors=[]
        def check(ok,message):
            if not ok: errors.append(message)
        ids=[b['id'] for b in p['items']]
        check(len(set(ids))==len(ids),'Building IDs must be unique')
        road={(x,p['road']['y']) for x in range(p['width'])}
        rb={(x,p['road']['y']) for x in p['road']['blocks']}
        walking=road-rb
        inside={(x,y) for x,y in walking if p['road']['blocks'][0]<x<p['road']['blocks'][1]}
        verges=set()
        if p['boulevard']:
            verges={(x,p['road']['y']+dy) for x in range(p['boulevard'][0],p['boulevard'][1]+1) for dy in [-1,1]}
        occupied={}
        for b in p['items']:
            for t in tiles(b):
                check(0<=t[0]<p['width'] and 0<=t[1]<p['height'],f"{b['id']} out of bounds at {t}")
                check(t not in verges,f"{b['id']} blocks a boulevard verge at {t}")
                if t in occupied:
                    prior=occupied[t]
                    check(b.get('parent')==prior['id'],f"Illegal overlap: {b['id']} / {prior['id']} at {t}")
                elif not b.get('parent'): occupied[t]=b
                check(t not in road or b['category']=='market',f"Building {b['id']} blocks road at {t}")
            if b.get('parent'):
                par=next(x for x in p['items'] if x['id']==b['parent'])
                check(tiles(b)<=tiles(par),f"{b['id']} outside its Agora")
            check(b['model'] in data['models']['Hero']['buildings'],f"Missing installed model {b['model']}")
        def access(b):
            if b['category']=='market': return tiles(b)&inside
            result=set()
            for x,y in tiles(b):
                for t in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    if t in inside: result.add(t)
                    if t in verges and (t[0],p['road']['y']) in inside: result.add((t[0],p['road']['y']))
            return result
        homes=[b for b in p['items'] if b['category'] in ['housing','common']]
        for b in p['items']:
            if b['category']!='beauty': check(bool(access(b)),f"No interior road access: {b['id']}")
        # BFS on the actual road graph, independent of the browser's straight-line calculation.
        def distances(start):
            dist={start:0};q=deque([start])
            while q:
                x,y=q.popleft()
                for t in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                    if t in inside and t not in dist:
                        dist[t]=dist[(x,y)]+1;q.append(t)
            return dist
        check(len(distances(next(iter(inside))))==len(inside),'Disconnected service street')
        check(all(sum(t in inside for t in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)])<=2 for x,y in inside),'Internal road junction')
        coverage=[]
        for b in p['items']:
            if 'reach' not in b or not homes: continue
            maxima=[]
            for source in access(b):
                ds=distances(source)
                maxima.append(max(min((ds.get(h,9999) for h in access(home)),default=9999) for home in homes))
            worst=max(maxima,default=9999)
            check(worst<=b['reach'],f"{b['id']} cannot reach every house from all touching road entries: {worst}>{b['reach']}")
            coverage.append(dict(provider=b['id'],worst_distance=worst,reference_roaming_range=b['reach']))
        if key=='elite':
            check(len(homes)==8,'Eight elite houses required')
            check(all(b['w']==4 and b['h']==4 for b in homes),'Elite footprint must be 4×4')
            check(len([b for b in p['items'] if b.get('parent')=='agora'])==6,'Six elite stalls required')
            check(sum(b['id'] in ['museum','stadium'] for b in p['items'])==1,'Exactly one final science/culture venue required')
        if key=='workers':
            check(len(homes)==16,'Sixteen worker homes required')
            check(all(b['w']==2 and b['h']==2 for b in homes),'Common footprint must be 2×2')
            check(any(b['id']=='fountain' for b in p['items']),'Common homes need a Fountain')
        jobs=sum(data['models']['Hero']['buildings'][b['model']][5] for b in p['items'])
        results.append(dict(civilization=mode,plan=key,dimensions=[p['width'],p['height']],jobs=jobs,buildings=len(p['items']),coverage=coverage,errors=errors,status='pass' if not errors else 'FAIL'))

for level,m in data['models'].items():
    assert m['houses'][12]['values'][17]==20,(level,'estate capacity')
    assert m['houses'][12]['values'][2]==(70 if level=='Beginner' else 80),(level,'estate score')
    assert m['houses'][6]['values'][17]==60,(level,'townhouse capacity')
    assert m['houses'][12]['values'][3]==0,(level,'elite water')
    assert m['houses'][6]['values'][3]==1,(level,'common water')

report={'checks':'Footprint bounds, overlaps, reserved boulevard verges, road graph, frontage, conservative provider-to-home distance for every possible touching entry tile, 5 difficulty models. Not an in-game test.', 'plans':results,'status':'pass' if not any(r['errors'] for r in results) else 'FAIL'}
(HERE/'validation.json').write_text(json.dumps(report,indent=2))
for r in results:
    print(f"{r['civilization']:8} {r['plan']:8}: {r['status']}, {r['jobs']} jobs, {len(r['coverage'])} providers checked")
    for e in r['errors'][:10]:print('  '+e)
assert report['status']=='pass','See validation.json'
