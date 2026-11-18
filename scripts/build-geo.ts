#!/usr/bin/env bun
// Sinh dữ liệu bản đồ gọn nhẹ cho đồ họa từ world-atlas (Natural Earth).
// bun scripts/build-geo.ts <countries-110m.json> <countries-50m.json>
import { feature } from "topojson-client";
import { $ } from "bun";

type Ring = [number, number][];
const [p110, p50] = process.argv.slice(2);
if (!p110 || !p50) throw new Error("Cần 2 tham số: countries-110m.json countries-50m.json");

function toPolys(topoPath: string, digits: number, bbox?: [number, number, number, number]) {
  return Bun.file(topoPath)
    .json()
    .then((topo: any) => {
      const fc = feature(topo, topo.objects.countries) as any;
      const out: { id: string; name: string; polys: Ring[][] }[] = [];
      for (const f of fc.features) {
        const g = f.geometry;
        if (!g) continue;
        const polys: number[][][][] = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
        const r = (n: number) => Math.round(n * 10 ** digits) / 10 ** digits;
        const kept = polys
          .map((poly) => poly.map((ring) => ring.map(([x, y]) => [r(x!), r(y!)] as [number, number])))
          .filter((poly) => {
            if (!bbox) return true;
            return poly[0]!.some(([x, y]) => x >= bbox[0] && x <= bbox[2] && y >= bbox[1] && y <= bbox[3]);
          });
        if (kept.length) out.push({ id: String(f.id ?? ""), name: f.properties?.name ?? "", polys: kept });
      }
      return out;
    });
}

await $`mkdir -p web/geo`;
const world = await toPolys(p110, 1);
const sea = await toPolys(p50, 2, [90, -2, 128, 32]);
await Bun.write("web/geo/world.json", JSON.stringify(world));
await Bun.write("web/geo/sea.json", JSON.stringify(sea));
console.log(`world: ${world.length} nước, sea: ${sea.length} nước`);
await $`ls -la web/geo`;
