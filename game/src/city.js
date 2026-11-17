// Solmar Bay — the city itself: road grid, districts, buildings, parks,
// streetlights, piers and the beach. Generation is seeded, so the same seed
// always builds the same city (that is what makes screenshots repeatable).

import {
  WORLD_W, WORLD_H, V_ROADS, H_ROADS, ROAD_HALF, HARBOR_WATER_X, BEACH_Y, SEA_Y,
  SPRAY_SHOP, SAFEHOUSE, ROSAS_PLACE, BANK, GARAGE, districtAt, COLORS, CAR_TYPES,
} from './config.js';
import { createRandom } from './random.js';

export function buildCity(seed) {
  const rand = createRandom(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const parkedCars = [];

  // One block per gap between neighbouring roads.
  for (let i = 0; i < V_ROADS.length - 1; i++) {
    for (let j = 0; j < H_ROADS.length - 1; j++) {
      const x0 = V_ROADS[i] + ROAD_HALF + 16;
      const x1 = V_ROADS[i + 1] - ROAD_HALF - 16;
      const y0 = H_ROADS[j] + ROAD_HALF + 16;
      const y1 = H_ROADS[j + 1] - ROAD_HALF - 16;
      if (y0 > BEACH_Y - 40) continue; // beach blocks stay open sand
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      // Landmarks claim their own blocks.
      if (rectOverlaps(x0, y0, x1, y1, SPRAY_SHOP) || rectOverlaps(x0, y0, x1, y1, SAFEHOUSE)
        || rectOverlaps(x0, y0, x1, y1, ROSAS_PLACE) || rectOverlaps(x0, y0, x1, y1, BANK)
        || rectOverlaps(x0, y0, x1, y1, GARAGE)) {
        continue;
      }
      const roll = rand();
      if (district === 'downtown') {
        // One tall slab per downtown block, with a rooftop detail colour.
        buildings.push(makeBuilding(x0 + 14, y0 + 14, x1 - x0 - 28, y1 - y0 - 28, 'downtown', rand));
      } else if (district === 'harbor') {
        buildings.push(makeBuilding(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20, 'harbor', rand));
      } else if (roll < 0.22) {
        // A pocket park: grass, trees, a path.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = 5 + Math.floor(rand() * 5);
        for (let t = 0; t < n; t++) {
          trees.push({ x: x0 + 20 + rand() * (x1 - x0 - 40), y: y0 + 20 + rand() * (y1 - y0 - 40), r: 12 + rand() * 10 });
        }
      } else if (roll < 0.34) {
        // A parking lot with a few parked cars to steal.
        const n = 2 + Math.floor(rand() * 3);
        for (let p = 0; p < n; p++) {
          const typeIndex = Math.floor(rand() * 6);
          const type = CAR_TYPES[typeIndex];
          parkedCars.push({
            x: x0 + 40 + rand() * (x1 - x0 - 80),
            y: y0 + 40 + rand() * (y1 - y0 - 80),
            angle: rand() < 0.5 ? 0 : Math.PI / 2,
            speed: 0,
            type: typeIndex,
            name: type.name,
            w: type.w,
            h: type.h,
            topSpeed: type.topSpeed,
            accel: type.accel,
            color: type.color,
            axis: 'h',
            road: 0,
            dir: 1,
            lane: 1,
            cruise: 0,
            isPolice: false,
            isPlayer: false,
            parked: true,
            brakeLight: false,
          });
        }
      } else {
        // Suburb houses: two or three small roofs per block.
        const count = 2 + Math.floor(rand() * 2);
        for (let h = 0; h < count; h++) {
          const bw = 70 + rand() * 60;
          const bh = 60 + rand() * 50;
          const bx = x0 + 12 + rand() * Math.max(1, x1 - x0 - bw - 24);
          const by = y0 + 12 + rand() * Math.max(1, y1 - y0 - bh - 24);
          buildings.push(makeBuilding(bx, by, bw, bh, 'suburb', rand));
        }
        if (rand() < 0.7) {
          trees.push({ x: x0 + 24 + rand() * (x1 - x0 - 48), y: y0 + 24 + rand() * (y1 - y0 - 48), r: 10 + rand() * 8 });
        }
      }
    }
  }

  // Streetlights at every other intersection corner.
  for (let i = 0; i < V_ROADS.length; i++) {
    for (let j = 0; j < H_ROADS.length; j++) {
      if ((i + j) % 2 !== 0) continue;
      lamps.push({ x: V_ROADS[i] + ROAD_HALF + 6, y: H_ROADS[j] - ROAD_HALF - 6 });
    }
  }

  // A few palm trees along the beach boardwalk.
  for (let x = 260; x < WORLD_W - 100; x += 180) {
    trees.push({ x: x + rand() * 60, y: BEACH_Y - 40 + rand() * 30, r: 13 + rand() * 6, palm: true });
  }

  return { buildings, trees, lamps, parks, parkedCars, seed };
}

function rectOverlaps(x0, y0, x1, y1, spot) {
  return spot.x < x1 && spot.x + spot.w > x0 && spot.y < y1 && spot.y + spot.h > y0;
}

function makeBuilding(x, y, w, h, district, rand) {
  const roof =
    district === 'downtown' ? COLORS.downtownRoof
    : district === 'harbor' ? COLORS.warehouseRoof
    : COLORS.houseRoof;
  return {
    x, y, w, h, district, roof,
    tall: district === 'downtown',
    // Deterministic window pattern seed, so roofs render the same every frame.
    winSeed: Math.floor(rand() * 100000),
  };
}

// -- Queries used by the rest of the game -------------------------------------

export function isOnRoad(x, y) {
  for (const vx of V_ROADS) if (Math.abs(x - vx) <= ROAD_HALF) return true;
  for (const hy of H_ROADS) if (Math.abs(y - hy) <= ROAD_HALF) return true;
  return false;
}

export function isInWater(x, y) {
  if (x < HARBOR_WATER_X) return true;
  if (y > SEA_Y) return true;
  return false;
}

export function isOnSidewalk(x, y) {
  // The strip just outside the asphalt, still inside the block margin.
  for (const vx of V_ROADS) {
    const d = Math.abs(x - vx);
    if (d > ROAD_HALF && d <= ROAD_HALF + 16) return true;
  }
  for (const hy of H_ROADS) {
    const d = Math.abs(y - hy);
    if (d > ROAD_HALF && d <= ROAD_HALF + 16) return true;
  }
  return false;
}

// Nearest point on any road centreline (used to keep traffic on the roads).
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const vx of V_ROADS) {
    const d = Math.abs(x - vx);
    if (d < bestD) { bestD = d; best = { x: vx, y, axis: 'v', road: vx }; }
  }
  for (const hy of H_ROADS) {
    const d = Math.abs(y - hy);
    if (d < bestD) { bestD = d; best = { x, y: hy, axis: 'h', road: hy }; }
  }
  return best;
}

// Push a circle out of every building it overlaps; returns true on a hit.
export function collideBuildings(entity, radius, buildings) {
  let hit = false;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(entity.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(entity.y, b.y + b.h));
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        entity.x = cx + (dx / d) * radius;
        entity.y = cy + (dy / d) * radius;
      } else {
        entity.x = b.x - radius;
      }
    }
  }
  return hit;
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// Traffic-light phase for an intersection: north-south green, then east-west.
export function lightPhase(time) {
  const cycle = 14; // seconds for a full NS+EW cycle
  const t = time % cycle;
  return t < 6 ? 'ns' : t < 7 ? 'ns-amber' : t < 13 ? 'ew' : 'ew-amber';
}

export function lightForAxis(time, axis) {
  const phase = lightPhase(time);
  if (axis === 'v') return phase === 'ns' ? 'green' : phase === 'ns-amber' ? 'amber' : 'red';
  return phase === 'ew' ? 'green' : phase === 'ew-amber' ? 'amber' : 'red';
}
