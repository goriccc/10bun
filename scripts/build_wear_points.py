#!/usr/bin/env python3
"""기상청 동네예보 지점 좌표 엑셀에서 시·군·구 목록을 만든다.
앱 코드는 이 스크립트를 부르지 않고 content/wear-points.json 만 읽는다.

원본: 기상자료개방포털 자료실, 동네예보지점좌표(위경도)_260930.xlsx
"""
import json
import sys
from pathlib import Path

import openpyxl

SIDO = {
    "서울특별시": "서울",
    "부산광역시": "부산",
    "대구광역시": "대구",
    "인천광역시": "인천",
    "대전광역시": "대전",
    "울산광역시": "울산",
    "세종특별자치시": "세종",
    "경기도": "경기",
    "강원특별자치도": "강원",
    "충청북도": "충북",
    "충청남도": "충남",
    "전북특별자치도": "전북",
    "경상북도": "경북",
    "경상남도": "경남",
    "제주특별자치도": "제주",
}
ORDER = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]
GWANGJU = {"동구", "서구", "남구", "북구", "광산구"}
ANCHOR = {
    "서울": (37.5663, 126.9784),
    "부산": (35.1796, 129.0756),
    "대구": (35.8714, 128.6014),
    "인천": (37.4563, 126.7052),
    "광주": (35.1595, 126.8526),
    "대전": (36.3504, 127.3845),
    "울산": (35.5384, 129.3114),
    "세종": (36.4801, 127.289),
    "경기": (37.2636, 127.0286),
    "강원": (37.8813, 127.73),
    "충북": (36.6424, 127.489),
    "충남": (36.6588, 126.6728),
    "전북": (35.8242, 127.148),
    "전남": (34.8161, 126.463),
    "경북": (36.5759, 128.5056),
    "경남": (35.2278, 128.6811),
    "제주": (33.4996, 126.5312),
}


def screen_sido(parent: str, name: str) -> str:
    if parent == "전남광주통합특별시":
        return "광주" if name in GWANGJU else "전남"
    return SIDO[parent]


def display_name(name: str) -> str:
    for mark in ("시",):
        cut = name.find(mark)
        if cut > 0 and name.endswith("구") and cut < len(name) - 1:
            return f"{name[: cut + 1]} {name[cut + 1 :]}"
    return name


def nearest(points: list[dict], lat: float, lon: float) -> dict:
    return min(points, key=lambda item: (item["lat"] - lat) ** 2 + (item["lon"] - lon) ** 2)


def main() -> None:
    book = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)
    sheet = book[book.sheetnames[0]]
    points = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not row or not row[2] or row[2] == "이어도":
            continue
        parent, raw_name, village = row[2], row[3] or "", row[4] or ""
        if village or not raw_name:
            continue
        if parent not in SIDO and parent != "전남광주통합특별시":
            raise SystemExit(f"unknown sido: {parent}")
        nx, ny = int(row[5]), int(row[6])
        lon, lat = float(row[13]), float(row[14])
        if not (1 <= nx <= 149 and 1 <= ny <= 253 and 33 <= lat <= 39 and 124 <= lon <= 132):
            raise SystemExit(f"point out of range: {parent} {raw_name}")
        points.append(
            {
                "code": str(row[1]),
                "sido": screen_sido(parent, raw_name),
                "name": display_name(raw_name),
                "nx": nx,
                "ny": ny,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
            }
        )
    codes = [item["code"] for item in points]
    if len(codes) != len(set(codes)):
        raise SystemExit("duplicate forecast point code")
    defaults = {}
    for sido in ORDER:
        group = [item for item in points if item["sido"] == sido]
        if not group:
            raise SystemExit(f"no points for {sido}")
        lat, lon = ANCHOR[sido]
        defaults[sido] = nearest(group, lat, lon)["code"]
    data = {
        "source": "기상청 동네예보 지점 좌표(2026-09-30)",
        "sidos": ORDER,
        "defaults": defaults,
        "points": [{key: item[key] for key in ("code", "sido", "name", "nx", "ny")} for item in points],
    }
    Path(sys.argv[2]).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(points), "points")
    for sido in ORDER:
        chosen = next(item for item in points if item["code"] == defaults[sido])
        print(sido, sum(1 for item in points if item["sido"] == sido), chosen["name"])


if __name__ == "__main__":
    main()
