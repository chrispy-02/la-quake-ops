#!/usr/bin/env python3
"""Snapshot real road-following geometry for the stylized LA road graph.

The graph in src/sim/roadNetwork.ts is topology + hand-placed interchange nodes;
its hand-traced edge shapes are coarse straight chords that visibly cut across
blocks when zoomed in. This tool fetches the real driving polyline between each
edge's two nodes (and from each hospital to its nearest node) from the public
OSRM server (OpenStreetMap data) and writes them to a checked-in snapshot the
app loads offline. Runtime stays key-free and deterministic; only edge `coords`
become real road geometry.

Because the hand-placed nodes sit slightly off the real road centerline, each
node is first snapped onto the road network (OSRM /nearest) so routing between
them follows the intended road instead of detouring via ramps/surface streets.
The stored geometry keeps the ORIGINAL node coordinates as its endpoints (a
short connector to the snapped point), so the graph nodes stay authoritative.
Any edge still implausibly long after snapping falls back to a straight chord.

Input:  src/data/raw/_graphdump.json  (produced by a one-off dump test)
Output: src/data/snapshots/roadGeometry.json

Usage:  python scripts/build-road-geometry.py
"""
from __future__ import annotations
import json, math, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "..", "src", "data", "raw", "_graphdump.json")
OUT = os.path.join(HERE, "..", "src", "data", "snapshots", "roadGeometry.json")
BASE = "https://router.project-osrm.org"
SNAP_MAX_M = 400      # ignore a snap that moves a node more than this
# Keep OSRM geometry unless it is wildly broken: even "inflated" OSRM routes
# stay ON roads (max segment < 1 km), whereas a straight-chord fallback cuts
# across blocks. Only a pathological detour (>8x) is worse than a straight line.
FALLBACK_RATIO = 8.0

def r5(v): return round(float(v), 5)

def hav(a, b):
    R = 6371.0; D = math.pi / 180
    dlat = (b[1]-a[1])*D; dlng = (b[0]-a[0])*D
    s = math.sin(dlat/2)**2 + math.cos(a[1]*D)*math.cos(b[1]*D)*math.sin(dlng/2)**2
    return 2*R*math.asin(min(1, math.sqrt(s)))

def plen(coords):
    return sum(hav(coords[i-1], coords[i]) for i in range(1, len(coords)))

def get(url, retries=3):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=25) as resp:
                return json.load(resp)
        except (urllib.error.URLError, TimeoutError, ValueError):
            time.sleep(1.0 + attempt)
    return None

def snap(pt):
    """Nearest road point to pt, or pt itself if snapping fails / moves too far."""
    d = get(f"{BASE}/nearest/v1/driving/{pt[0]},{pt[1]}?number=1")
    if not d or d.get("code") != "Ok" or not d.get("waypoints"):
        return pt
    wp = d["waypoints"][0]
    loc = wp["location"]
    if wp.get("distance", 0) > SNAP_MAX_M:
        return pt
    return [loc[0], loc[1]]

def route(a, b):
    """Driving polyline a->b (geojson coords), or None."""
    url = f"{BASE}/route/v1/driving/{a[0]},{a[1]};{b[0]},{b[1]}?overview=full&geometries=geojson"
    d = get(url)
    if not d or d.get("code") != "Ok" or not d.get("routes"):
        return None
    c = d["routes"][0]["geometry"]["coordinates"]
    return c if len(c) >= 2 else None

def edge_geometry(orig_a, orig_b, snap_a, snap_b):
    """Real geometry between two nodes, with original coords forced as endpoints.
    Falls back to a straight chord if OSRM detours implausibly."""
    straight = hav(orig_a, orig_b)
    c = route(snap_a, snap_b)
    if c is not None:
        coords = [[r5(x[0]), r5(x[1])] for x in c]
        coords[0] = [r5(orig_a[0]), r5(orig_a[1])]
        coords[-1] = [r5(orig_b[0]), r5(orig_b[1])]
        if straight < 0.2 or plen(coords) / straight <= FALLBACK_RATIO:
            return coords, False
    return [[r5(orig_a[0]), r5(orig_a[1])], [r5(orig_b[0]), r5(orig_b[1])]], True

def main():
    if not os.path.exists(RAW):
        print("Missing", RAW, "- run the graph-dump test first.", file=sys.stderr)
        sys.exit(1)
    dump = json.load(open(RAW))
    nodes = dump["nodes"]

    # 1) Snap every node onto the road network once.
    snapped = {}
    ids = list(nodes.keys())
    for i, nid in enumerate(ids, 1):
        snapped[nid] = snap(nodes[nid])
        if i % 25 == 0 or i == len(ids):
            print(f"  snapped nodes {i}/{len(ids)}")
        time.sleep(0.15)

    # 2) Route each edge between snapped node positions.
    edges_out = {}
    fell_back = 0
    total = len(dump["edges"])
    for i, e in enumerate(dump["edges"], 1):
        geom, fb = edge_geometry(nodes[e["a"]], nodes[e["b"]], snapped[e["a"]], snapped[e["b"]])
        edges_out[e["id"]] = geom
        if fb:
            fell_back += 1
        if i % 25 == 0 or i == total:
            print(f"  edges {i}/{total} (straight fallbacks: {fell_back})")
        time.sleep(0.18)

    # 3) Hospital access: snapped nearest node -> hospital location.
    hosp_out = {}
    for h in dump["hospitals"]:
        node_orig = nodes[h["nodeId"]]
        geom, _ = edge_geometry(node_orig, h["lngLat"], snapped[h["nodeId"]], snap(h["lngLat"]))
        hosp_out[h["id"]] = {"nodeId": h["nodeId"], "coords": geom}
        time.sleep(0.18)
    print(f"  hospital-access edges: {len(hosp_out)}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "source": "OSRM (router.project-osrm.org) · © OpenStreetMap contributors",
            "edges": edges_out,
            "hospitalAccess": hosp_out,
        }, f, separators=(",", ":"))
    print(f"Wrote {OUT}  ({os.path.getsize(OUT)/1024:.0f} KB, {total} edges, {fell_back} straight fallbacks)")

if __name__ == "__main__":
    main()
