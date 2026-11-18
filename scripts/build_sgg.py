#!/usr/bin/env python3
"""오늘의 동네 데이터 가공.
입력: 국가데이터처 센서스 시군구 경계 (BND_SIGUNGU_PG, 2025년 6월, EPSG:5186 상당 TM)
출력: content/dongne-sgg.json (229개 시군구), content/dongne-sido.json (17개 시도, 쉬운 모드)
- 일반구(수원시 장안구 등 35개)는 소속 시로 합침 → 기초자치단체 기준 229개
- 실루엣: 200x200 viewBox SVG path (모양마다 꽉 차게 정규화, 북쪽이 위)
- 중심점: 면적 중심을 WGS84 위경도로 변환 (거리·방향 힌트용)
"""
import json, sys, collections
import shapefile
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union
from pyproj import CRS, Transformer

RAW = sys.argv[1]; OUT = sys.argv[2]
SIDO = {'11':('서울특별시','서울'),'21':('부산광역시','부산'),'22':('대구광역시','대구'),'23':('인천광역시','인천'),
        '24':('광주광역시','광주'),'25':('대전광역시','대전'),'26':('울산광역시','울산'),'29':('세종특별자치시','세종'),
        '31':('경기도','경기'),'32':('강원특별자치도','강원'),'33':('충청북도','충북'),'34':('충청남도','충남'),
        '35':('전북특별자치도','전북'),'36':('전라남도','전남'),'37':('경상북도','경북'),'38':('경상남도','경남'),
        '39':('제주특별자치도','제주')}
METRO = {'11','21','22','23','24','25','26'}

r = shapefile.Reader(RAW, encoding='cp949')
crs = CRS.from_wkt(open(RAW + '.prj').read())
tf = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
base_date = r.record(0)[0]

groups = collections.OrderedDict()   # key -> dict(code, name, sido, geoms)
for sr in r.iterShapeRecords():
    date, code, nm = sr.record[:3]
    sd = code[:2]
    name = nm
    if sd not in METRO and ' ' in nm:          # 일반구 → 시
        name = nm.split(' ')[0]
    key = (sd, name)
    g = groups.setdefault(key, {'codes': [], 'name': name, 'sd': sd, 'geoms': []})
    g['codes'].append(code)
    g['geoms'].append(shape(sr.shape.__geo_interface__).buffer(0))

def parts(geom):
    return list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]

def svg_path(geom, size=200, pad=10):
    ps = sorted(parts(geom), key=lambda p: -p.area)
    big = ps[0].area
    reach = 0.6 * big ** 0.5                                  # 가장 큰 덩어리 크기에 비례한 거리
    cand = [p for p in ps if p.area >= big * 0.01][:60]
    main = cand[0].simplify(reach * 0.01)
    keep = [p for p in cand if p is cand[0] or main.distance(p.envelope) <= reach][:40]  # 작은 섬·먼 섬 생략
    minx, miny, maxx, maxy = unary_union([p.envelope for p in keep]).bounds
    w, h = maxx - minx, maxy - miny
    tol = max(w, h) * 0.0025                                 # 모양 크기에 비례한 단순화
    s = (size - 2 * pad) / max(w, h)
    ox = (size - w * s) / 2; oy = (size - h * s) / 2
    out = []
    for p in keep:
        p = p.simplify(tol, preserve_topology=True)
        for ring in [p.exterior] + list(p.interiors):
            pts = [(ox + (x - minx) * s, oy + (maxy - y) * s) for x, y in ring.coords[:-1]]
            if len(pts) < 3: continue
            out.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z')
    return ''.join(out), round(w / max(w, h), 3), round(h / max(w, h), 3)

def latlng(geom):
    c = geom.centroid
    if not geom.contains(c):           # 섬·C자 모양이면 내부의 대표점
        c = geom.representative_point()
    lng, lat = tf.transform(c.x, c.y)
    return round(lat, 5), round(lng, 5)

items = []
sido_geoms = collections.defaultdict(list)
for (sd, name), g in groups.items():
    geom = unary_union(g['geoms'])
    sido_geoms[sd].append(geom)
    path, aw, ah = svg_path(geom)
    lat, lng = latlng(geom)
    full, short = SIDO[sd]
    label = name if sd == '29' else f'{short} {name}'
    items.append({'code': sorted(g['codes'])[0][:4] + ('0' if len(g['codes']) > 1 else sorted(g['codes'])[0][4]),
                  'name': name, 'sido': full, 'sido_short': short, 'label': label,
                  'lat': lat, 'lng': lng, 'area_km2': round(geom.area / 1e6, 1),
                  'merged_gu': [c for c in sorted(g['codes'])] if len(g['codes']) > 1 else [],
                  'path': path})

labels = collections.Counter(i['label'] for i in items)
assert all(v == 1 for v in labels.values()), [k for k, v in labels.items() if v > 1]

src = {'source': '국가데이터처 센서스 공간정보 (시군구 경계 BND_SIGUNGU_PG)', 'base_date': base_date,
       'license': '공공데이터포털 이용허락범위 제한 없음', 'credit': '자료: 국가데이터처 센서스 경계(' + base_date[:4] + '.' + base_date[4:6] + ')'}
json.dump({**src, 'viewBox': '0 0 200 200', 'count': len(items), 'items': items},
          open(f'{OUT}/dongne-sgg.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

sidos = []
for sd, gs in sido_geoms.items():
    geom = unary_union(gs)
    path, _, _ = svg_path(geom)
    lat, lng = latlng(geom)
    sidos.append({'code': sd, 'name': SIDO[sd][0], 'label': SIDO[sd][1], 'lat': lat, 'lng': lng, 'path': path})
json.dump({**src, 'viewBox': '0 0 200 200', 'count': len(sidos), 'items': sidos},
          open(f'{OUT}/dongne-sido.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

print('sgg', len(items), 'sido', len(sidos))
print('merged:', [(i['label'], len(i['merged_gu'])) for i in items if i['merged_gu']])
