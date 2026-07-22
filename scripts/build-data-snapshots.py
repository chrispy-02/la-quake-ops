#!/usr/bin/env python3
"""Derive the checked-in REAL BASE DATA snapshots under src/data/snapshots/.

This is a one-time / refresh derivation tool, not part of the app runtime. The
app ships the compact JSON snapshots it emits; those are the authoritative
"fallback snapshot" the data layer loads. Re-run to refresh from source.

Raw inputs (download into RAW_DIR, default ./data/raw) — see each source's
provenance entry in src/data/provenance.ts for URL / license / retrieval date:

  hcai.csv                     HCAI "Current Healthcare Facility Listing" CSV
  qf_{0,2000,4000,6000}.geojson  USGS Qfaults layer 21, metro bbox, generalized
  cenpop.txt                   Census 2020 Centers of Population, tracts, CA (06)
  county-simpl.geojson         Census TIGERweb LA County (GEOID 06037), generalized
  csa.json                     LA County Countywide Statistical Areas, centroids

Usage:  RAW_DIR=/path/to/raw  python scripts/build-data-snapshots.py
"""
from __future__ import annotations
import csv, json, math, os, sys
from collections import defaultdict

RAW = os.environ.get("RAW_DIR", os.path.join(os.path.dirname(__file__), "..", "data", "raw"))
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "snapshots")
os.makedirs(OUT, exist_ok=True)

def rd(name): return os.path.join(RAW, name)
def wr(name, obj):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  wrote {name}  ({os.path.getsize(p)/1024:.1f} KB)")

def r2(x): return round(float(x), 5)

# ── Hospitals ────────────────────────────────────────────────────────────
# id → (HCAI FACILITY_NAME, display name, short label, trauma adult, trauma peds)
# Trauma designations are from the California EMSA "Designated Trauma Centers"
# sheet (LA County / Southwest region rows); adult I/II/III/IV, peds I/II.
ROSTER = [
    ("lacusc",       "LOS ANGELES GENERAL MEDICAL CENTER",                          "Los Angeles General Medical Center", "LA General",  "I",  "II"),
    ("cedars",       "CEDARS-SINAI MEDICAL CENTER",                                 "Cedars-Sinai Medical Center",        "Cedars",      "I",  None),
    ("ucla",         "RONALD REAGAN UCLA MEDICAL CENTER",                           "Ronald Reagan UCLA Medical Center",  "UCLA",        "I",  "II"),
    ("harbor",       "LAC/HARBOR-UCLA MEDICAL CENTER",                              "Harbor-UCLA Medical Center",         "Harbor-UCLA", "I",  None),
    ("chla",         "CHILDREN'S HOSPITAL OF LOS ANGELES",                          "Children's Hospital Los Angeles",    "CHLA",        None, "I"),
    ("california",   "CALIFORNIA HOSPITAL MEDICAL CENTER - LOS ANGELES",           "California Hospital Medical Center",  "California",  "II", None),
    ("goodsam",      "PIH HEALTH GOOD SAMARITAN HOSPITAL",                          "PIH Health Good Samaritan Hospital", "Good Sam",    None, None),
    ("whitemem",     "ADVENTIST HEALTH WHITE MEMORIAL",                             "Adventist Health White Memorial",    "White Mem.",  None, None),
    ("hollywoodpres","HOLLYWOOD PRESBYTERIAN MEDICAL CENTER",                       "CHA Hollywood Presbyterian",         "Hlwd Pres.",  None, None),
    ("kaiserla",     "KAISER FOUNDATION HOSPITAL - LOS ANGELES",                    "Kaiser Permanente LA Medical Center","Kaiser LA",   None, None),
    ("huntington",   "HUNTINGTON HOSPITAL",                                         "Huntington Hospital",                "Huntington",  "II", None),
    ("glendaleadv",  "ADVENTIST HEALTH GLENDALE",                                   "Adventist Health Glendale",          "Glendale Adv.",None,None),
    ("stjoseph",     "PROVIDENCE SAINT JOSEPH MEDICAL CENTER",                      "Providence Saint Joseph",            "St. Joseph",  None, None),
    ("valleypres",   "VALLEY PRESBYTERIAN HOSPITAL",                                "Valley Presbyterian Hospital",       "Valley Pres.",None, None),
    ("northridge",   "NORTHRIDGE HOSPITAL MEDICAL CENTER",                          "Northridge Hospital Medical Center", "Northridge",  "II", None),
    ("holycross",    "PROVIDENCE HOLY CROSS MEDICAL CENTER",                        "Providence Holy Cross",              "Holy Cross",  "II", None),
    ("oliveview",    "LOS ANGELES COUNTY OLIVE VIEW-UCLA MEDICAL CENTER",           "Olive View-UCLA Medical Center",     "Olive View",  None, None),
    ("mlk",          "MARTIN LUTHER KING, JR. COMMUNITY HOSPITAL",                  "MLK Jr. Community Hospital",          "MLK Community",None,None),
    ("stfrancis",    "ST. FRANCIS MEDICAL CENTER",                                  "St. Francis Medical Center",         "St. Francis", "II", None),
    ("lbmemorial",   "MEMORIALCARE LONG BEACH MEDICAL CENTER",                      "Long Beach Medical Center",          "LB Medical",  "II", "II"),
    ("stmary",       "ST. MARY MEDICAL CENTER - LONG BEACH",                        "Dignity Health St. Mary",            "St. Mary",    "II", None),
    ("torrance",     "TORRANCE MEMORIAL MEDICAL CENTER",                            "Torrance Memorial Medical Center",   "Torrance Mem.",None,None),
    ("smucla",       "SANTA MONICA - UCLA MEDICAL CENTER AND ORTHOPAEDIC HOSPITAL", "UCLA Santa Monica Medical Center",   "UCLA SM",     None, None),
    ("stjohns",      "SAINT JOHN'S HEALTH CENTER",                                  "Providence Saint John's",            "St. John's",  None, None),
]
ER_MAP = {"Emergency - Comprehensive":"comprehensive","Emergency - Basic":"basic",
          "Emergency - Standby":"standby","None":"none"}

def build_hospitals():
    rows = list(csv.DictReader(open(rd("hcai.csv"), encoding="utf-8-sig")))
    by_name = {}
    for r in rows:
        if r["FACILITY_STATUS_DESC"] == "Open" and r["FACILITY_LEVEL_DESC"] in ("Parent Facility","Free Standing"):
            by_name[r["FACILITY_NAME"]] = r
    out = []
    for hid, hcai_name, disp, short, ta, tp in ROSTER:
        h = by_name.get(hcai_name)
        if not h:
            print(f"  !! missing HCAI row for {hcai_name}", file=sys.stderr); sys.exit(1)
        out.append({
            "id": hid, "name": disp, "short": short,
            "oshpdId": h["OSHPD_ID"],
            "lngLat": [r2(h["LONGITUDE"]), r2(h["LATITUDE"])],
            "city": h["DBA_CITY"].title(),
            "licensedBeds": int(h["TOTAL_NUMBER_BEDS"]),
            "erLevel": ER_MAP.get(h["ER_SERVICE_LEVEL_DESC"], "none"),
            "traumaAdult": ta, "traumaPeds": tp,
        })
    wr("hospitals.json", out)

# ── Faults ───────────────────────────────────────────────────────────────
# Curated set of named faults relevant to the LA metro; others dropped to keep
# the snapshot small. Each fault becomes a MultiLineString of generalized paths.
FAULT_KEEP = {
    "Puente Hills blind thrust system","Newport-Inglewood-Rose Canyon fault zone",
    "Raymond fault","Hollywood fault","Santa Monica fault","Verdugo fault",
    "Sierra Madre fault zone","Palos Verdes fault zone","Whittier fault",
    "Upper Elysian Park fault","Lower Elysian Park thrust","Compton thrust fault",
    "Northridge blind thrust","Northridge Hills fault","San Andreas fault zone",
    "Malibu Coast fault zone","San Gabriel fault zone","Clamshell-Sawpit fault",
    "Eagle Rock fault","San Jose fault","Chino fault zone","Cucamonga fault zone",
}
def build_faults():
    feats = []
    for off in (0, 2000, 4000, 6000):
        p = rd(f"qf_{off}.geojson")
        if not os.path.exists(p): continue
        feats += json.load(open(p, encoding="utf-8"))["features"]
    groups = defaultdict(list)
    slip = {}
    for f in feats:
        nm = f["properties"].get("fault_name") or ""
        if nm not in FAULT_KEEP: continue
        g = f["geometry"]
        if not g: continue
        parts = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for line in parts:
            if len(line) < 2: continue
            groups[nm].append([[r2(c[0]), r2(c[1])] for c in line])
        sr = f["properties"].get("slip_rate")
        if sr and nm not in slip: slip[nm] = sr
    out = []
    for nm, lines in sorted(groups.items()):
        # drop near-duplicate/tiny fragments; keep the longest ~12 paths
        lines = [ln for ln in lines if _linelen(ln) > 0.6]
        lines.sort(key=_linelen, reverse=True)
        out.append({"name": nm, "slipRate": slip.get(nm), "lines": lines[:14]})
    wr("faults.json", out)

def _linelen(line):
    t = 0.0
    for i in range(1, len(line)):
        t += _haversine(line[i-1], line[i])
    return t

def _haversine(a, b):
    R = 6371.0; d = math.pi/180
    dlat = (b[1]-a[1])*d; dlng = (b[0]-a[0])*d
    s = math.sin(dlat/2)**2 + math.cos(a[1]*d)*math.cos(b[1]*d)*math.sin(dlng/2)**2
    return 2*R*math.asin(min(1, math.sqrt(s)))

# ── Population (tract centroids) ──────────────────────────────────────────
def build_population():
    pts = []
    for line in open(rd("cenpop.txt"), encoding="utf-8-sig"):
        parts = line.strip().split(",")
        if len(parts) < 6 or parts[0] != "06" or parts[1] != "037": continue
        try:
            pop = int(parts[3]); lat = float(parts[4]); lng = float(parts[5])
        except ValueError:
            continue
        if pop <= 0: continue
        pts.append([r2(lng), r2(lat), pop])
    # compact: [lng, lat, pop] triples
    wr("population.json", {"note": "Census 2020 tract centers of population, LA County (FIPS 06037)",
                           "points": pts})

# ── County boundary ──────────────────────────────────────────────────────
def build_county():
    g = json.load(open(rd("county-simpl.geojson"), encoding="utf-8"))["features"][0]["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    rings = []
    for p in polys:
        for r in p:
            rings.append([[r2(c[0]), r2(c[1])] for c in r])
    wr("county.json", {"rings": rings})

# ── Neighborhoods (CSA centroids) ────────────────────────────────────────
def build_neighborhoods():
    d = json.load(open(rd("csa.json"), encoding="utf-8"))
    out = []
    for f in d["features"]:
        a = f["attributes"]; c = f.get("centroid")
        if not c: continue
        name = (a.get("LABEL") or a.get("COMMUNITY") or a.get("LCITY") or "").strip()
        if not name: continue
        out.append([r2(c["x"]), r2(c["y"]), name])
    wr("neighborhoods.json", out)

if __name__ == "__main__":
    print("Building REAL BASE DATA snapshots →", os.path.abspath(OUT))
    build_hospitals()
    build_faults()
    build_population()
    build_county()
    build_neighborhoods()
    print("Done.")
