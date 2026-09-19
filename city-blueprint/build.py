"""Build the offline blueprint from the installed difficulty models. No dependencies."""
from pathlib import Path
import argparse
import csv
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--game-root", type=Path, required=True)
ROOT = parser.parse_args().game_root.resolve()
DIFFICULTIES = {"Beginner": "VeryEasy", "Mortal": "Easy", "Hero": "Normal", "Titan": "Hard", "Olympian": "Impossible"}
models = {}
for label, suffix in DIFFICULTIES.items():
    raw = (ROOT / f"Model/Zeus_Model_{suffix}.txt").read_text()
    buildings = {}
    for line in raw.split("ALL HOUSES")[0].splitlines():
        m = re.match(r"(\d+),(.+?),\{,([^}]+)", line)
        if m:
            numbers = [int(x) for x in m[3].split(",") if x.strip()]
            buildings[m[2].strip()] = numbers
    houses = []
    for line in raw.split("ALL HOUSES")[1].splitlines():
        if "{" in line:
            name, nums = line.split("{", 1)
            values = [int(x) for x in nums.split(",")[1:22]]
            houses.append({"name": name.rstrip(","), "values": values})
    models[label] = {"buildings": buildings, "houses": houses}

def item(id, name, code, category, x, y, w, h, model=None, note="", **extra):
    return dict(id=id, name=name, code=code, category=category, x=x, y=y, w=w, h=h, model=model, note=note, **extra)

def garden_fill(items, ranges):
    occupied = {(x, y) for b in items for x in range(b['x'], b['x']+b['w']) for y in range(b['y'], b['y']+b['h'])}
    for x0,y0,x1,y1 in ranges:
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                if (x,y) not in occupied:
                    items.append(item(f"park-{x}-{y}", "Park", "", "beauty", x,y,1,1,"BUILD_GARDENS", "One ordinary park tile. Keep this space green; it is not a road."))
                    occupied.add((x,y))

def road_plan(width, y):
    return {"y":y, "x0":0, "x1":width-1, "blocks":[1,width-2]}

def elite(mode):
    a = []
    for row,y in enumerate([5,12]):
        for col,x in enumerate([10,15,20,25]):
            n=row*4+col+1
            a.append(item(f"E{n}",f"Elite plot {n}",f"E{n}","housing",x,y,4,4,"BUILD_ELITE_VACANT", "Place separate elite housing here. Target: Estate, 20 residents. The boulevard gives road access across its planted verge. Water is supplied on site."))
            a.append(item(f"pond-{n}", "Fish Pond", "POND", "beauty", x,1 if row==0 else 16,4,4,"BUILD_FISH_POND", "Permanent rear beauty reserve. Build before the elite plot. The pond is decorative; it does not distribute drinking water."))
    if mode == "poseidon":
        a += [item("museum","Museum","MUSEUM","science",2,4,6,6,"BUILD_MUSUEM","One per city. Requires curators from a road-connected University in the support yard. Both the building and actual curator visits matter.", reach=35),
              item("observatory","Observatory","OBS","science",3,11,5,5,"BUILD_OBSERVATORY","Requires trained astronomers from a University. Its roaming astronomers serve this street.",reach=35),
              item("library","Bibliotheke","BIB","science",29,8,2,2,"BUILD_BIBLIOTHEKE","Produces scholars directly when staffed.",reach=35),
              item("lab","Laboratory","LAB","science",31,6,4,4,"BUILD_LABORATORY","Requires inventors from an Inventors’ Workshop. The workshop itself is in the support yard.",reach=35)]
    else:
        a += [item("stadium","Stadium, rotated","STADIUM","science",2,0,5,10,"BUILD_STADIUM","One per city. Rotate the 10×5 footprint to 5×10. Needs competitors from a Gymnasium. Its roaming competitors serve this street.",reach=35),
              item("theater","Theater","THEATER","science",3,11,5,5,"BUILD_THEATRE","Needs actors trained at a road-connected Drama School.",reach=35),
              item("podium","Podium","POD","science",29,8,2,2,"BUILD_PODIUM","Needs philosophers trained at a College.",reach=35),
              item("gym","Gymnasium","GYM","science",31,7,3,3,"BUILD_GYMNASIUM","Produces athletes and sends competitors to the Stadium.",reach=35)]
    a += [item("tax","Tax Office","TAX","civic",8,8,2,2,"BUILD_TAX_OFFICE","Requires the city's Palace. Tax collection is not an evolution requirement.",reach=35),
          item("maintenance","Maintenance Office","MT","safety",8,11,2,2,"BUILD_SUPER_OFFICE","Keep staffed before occupying houses. Superintendent visits reduce fire and collapse risk throughout the street.",reach=44),
          item("clinic","Infirmary","HEALTH","safety",29,11,4,4,"BUILD_INFIRMARY","Healers serve all eight elite plots along the street. Included for health, especially on higher difficulties; health is separate from the culture score.",reach=27),
          item("watch","Watchpost · optional","WP","safety",33,11,2,2,"BUILD_GUARDPOST","Optional: elite homes reduce unrest in the model. This is a reserve for local security, not a housing upgrade requirement.",reach=44,optional=True),
          item("agora","Grand Agora","AGORA","market",35,8,6,5,"BUILD_AGORA_LARGE","Build across the existing straight road, with three 2×2 stalls on each side. Roadblock goes immediately beyond its eastern end, not between the Agora and the homes.",reach=44)]
    for k,(name,model) in enumerate([("Food","BUILD_FOOD_VENDOR"),("Fleece","BUILD_FLEECE_VENDOR"),("Oil","BUILD_OIL_VENDOR"),("Wine","BUILD_WINE_VENDOR"),("Armor","BUILD_ARMS_VENDOR"),("Chariots" if mode=="poseidon" else "Horses","BUILD_CHARIOT_VENDOR" if mode=="poseidon" else "BUILD_HORSE_TRAINER")]):
        a.append(item(f"vendor-{k}",name+" stall",name[:3].upper(),"vendor",35+(k%3)*2,8 if k<3 else 11,2,2,model,"Part of the Grand Agora. Give the buyer road access to the appropriate stock source beyond the roadblock.",parent="agora"))
    garden_fill(a, [(9,0,29,4),(9,16,29,20),(14,5,14,8),(19,5,19,8),(24,5,24,8),(14,12,14,15),(19,12,19,15),(24,12,24,15)])
    return dict(id="elite",name="Eight-estate promenade",width=43,height=21,road=road_plan(43,10),boulevard=[10,28],items=a, residents=160, homes=8,
                description="An 8-estate service district on one straight street. The 43×21 envelope includes all local service buildings and the rear beauty reserves; shared workers, training, storage and production are separate.")

def workers(mode):
    a=[]
    for row,y in enumerate([5,8]):
        for col in range(8):
            n=row*8+col+1
            a.append(item(f"C{n}",f"Common home {n}",f"C{n}","common",10+col*2,y,2,2,"BUILD_HOUSE1_HUT","Target: Townhouse, 60 residents. Supplies the city workforce. This house never becomes an elite house."))
    if mode=="poseidon":
        a += [item("observatory","Observatory","OBS","science",2,2,5,5,"BUILD_OBSERVATORY","University in support yard must supply astronomers.",reach=35),item("library","Bibliotheke","BIB","science",7,5,2,2,"BUILD_BIBLIOTHEKE","Scholars plus astronomers plus inventors give 60 science points, above the 45-point townhouse requirement.",reach=35),item("lab","Laboratory","LAB","science",26,3,4,4,"BUILD_LABORATORY","Requires an Inventors’ Workshop in the support yard.",reach=35)]
    else:
        a += [item("theater","Theater","THEATER","science",2,2,5,5,"BUILD_THEATRE","Requires actors from a Drama School.",reach=35),item("podium","Podium","POD","science",7,5,2,2,"BUILD_PODIUM","Requires philosophers from a College.",reach=35),item("gym","Gymnasium","GYM","science",26,4,3,3,"BUILD_GYMNASIUM","The three local culture types total 60; a townhouse requires 45.",reach=35)]
    a += [item("clinic","Infirmary","HEALTH","safety",4,8,4,4,"BUILD_INFIRMARY","Provides healer visits to the common homes.",reach=27),item("fountain","Fountain","WTR","water",8,8,2,2,"BUILD_FOUNTAIN","Essential for common homes from Hovel onward. Staff it so water bearers walk past the homes.",reach=27),item("maintenance","Maintenance Office","MT","safety",2,8,2,2,"BUILD_SUPER_OFFICE","Fire and collapse protection.",reach=44),item("tax","Tax Office","TAX","civic",26,8,2,2,"BUILD_TAX_OFFICE","Requires the Palace in the support yard.",reach=35),item("watch","Watchpost","WP","safety",28,8,2,2,"BUILD_GUARDPOST","Suppresses local unrest; keep food, employment and tax policy healthy too.",reach=44),item("agora","Common Agora","AGORA","market",30,7,6,3,"BUILD_AGORA_SMALL","Orient the stalls south of the street. Stocks food, fleece and olive oil. A Grand Agora is not needed here.",reach=44)]
    for k,(name,model) in enumerate([("Food","BUILD_FOOD_VENDOR"),("Fleece","BUILD_FLEECE_VENDOR"),("Oil","BUILD_OIL_VENDOR")]):
        a.append(item(f"vendor-{k}",name+" stall",name[:3].upper(),"vendor",30+k*2,8,2,2,model,"Stock through the city road beyond the eastern roadblock.",parent="agora"))
    garden_fill(a,[(9,2,25,4),(10,10,25,13),(9,5,9,6)])
    return dict(id="workers",name="Common-housing starter",width=38,height=14,road=road_plan(38,7),boulevard=None,items=a,residents=960,homes=16,
                description="Sixteen 2×2 common homes, each with direct road frontage, support the city workforce. Maximum 960 residents is population, not a promise of 960 available workers. Add homes when the employment panel shows a shortage.")

def support(mode):
    a=[]
    for n,x in enumerate([2,6]):
        a.append(item(f"school-{n}","University" if mode=="poseidon" else "College","UNI" if mode=="poseidon" else "COL","training",x,5,3,3,"BUILD_UNIVERSITY" if mode=="poseidon" else "BUILD_COLLEGE","Starter allowance: one trainer for each district. Watch actual arrivals and add capacity if a venue waits for trainees."))
    for n,x in enumerate([10,14]):
        a.append(item(f"workshop-{n}","Inventors’ Workshop" if mode=="poseidon" else "Drama School","INV" if mode=="poseidon" else "DRAMA","training",x,5,3,3,"BUILD_INVENTORS_WORKSHOP" if mode=="poseidon" else "BUILD_DRAMA_SCHOOL","Trains the specialist who walks through roadblocks to the service venue. Keep a continuous road to both districts."))
    a += [item("granary","Granary","FOOD","storage",18,4,4,4,"BUILD_GRANARY","Food vendor buyers collect here. Accept only foods you actually produce or import; set getting orders when relying on a distant distribution hub."),item("store-1","Storehouse · household goods","GOODS","storage",23,5,3,3,"BUILD_STOREHOUSE","Reserve bays for fleece, olive oil and wine. Use receiving/getting orders appropriate to your supply network."),item("store-2","Storehouse · armor & ranch supplies","ARMS","storage",27,5,3,3,"BUILD_STOREHOUSE","Reserve armor and wheat for the Horse Ranch; wheat stored here is not citizen food. In Atlantis also reserve factory wood. Finished chariots come from the Chariot Factory; a warehouse of wood alone cannot supply an elite home."),item("maintenance","Maintenance Office","MT","safety",30,6,2,2,"BUILD_SUPER_OFFICE","Protects the supply and training buildings.",reach=44),item("palace","Palace","PALACE","civic",2,9,9,6,"BUILD_PALACE","One per city, required for taxation and military organization. If already built, keep the existing Palace and omit this copy."),item("maintenance-2","Maintenance Office","MT","safety",12,9,2,2,"BUILD_SUPER_OFFICE","A second office provides overlap around the shared civic and storage facilities.",reach=44),item("watch","Watchpost · optional","WP","safety",14,9,2,2,"BUILD_GUARDPOST","Optional security capacity.",reach=44,optional=True)]
    return dict(id="support",name="Shared supply & training yard",width=33,height=16,road=road_plan(33,8),boulevard=None,items=a,residents=0,homes=0,
                description="Connect this road to the right-hand city exits of both housing districts. Put the junctions outside the district roadblocks. Farms, industry, ranches and trade buildings depend on the map and are additional to this yard.")

data={"version":1,"date":"2026-09-19","executable_sha256":hashlib.sha256((ROOT/'zeus.exe').read_bytes()).hexdigest(),"models":models,"plans":{m:{p['id']:p for p in [elite(m),workers(m),support(m)]} for m in ['poseidon','zeus']}}
(HERE/'blueprint.json').write_text(json.dumps(data,indent=2))
for mode,plans in data['plans'].items():
    for name,p in plans.items():
        with (HERE/f'{mode}-{name}.csv').open('w',newline='') as f:
            writer=csv.writer(f)
            writer.writerow(['id','building','column_1_based','row_1_based','width','height','note'])
            for b in p['items']:
                writer.writerow([b['id'],b['name'],b['x']+1,b['y']+1,b['w'],b['h'],b['note']])
            writer.writerow(['road','Continuous road',1,p['road']['y']+1,p['width'],1,'Build first, including beneath the Agora.'])
            for n,x in enumerate(p['road']['blocks']):
                writer.writerow([f'roadblock-{n}','Roadblock',x+1,p['road']['y']+1,1,1,'Place on existing road. Keep city intersections outside.'])
            if p['boulevard']:
                x0,x1=p['boulevard']
                writer.writerow(['boulevard','Boulevard with both planted verges',x0+1,p['road']['y'],x1-x0+1,3,'Existing road is the middle row. Keep verges clear.'])
template=(HERE/'template.html').read_text()
(HERE/'index.html').write_text(template.replace('/*__BLUEPRINT_DATA__*/',json.dumps(data,separators=(',',':'))))
print('Built standalone index.html, blueprint.json and six coordinate CSVs.')
