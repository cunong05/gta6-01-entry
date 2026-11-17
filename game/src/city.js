// Solmar Bay's city: a fixed grid of avenues and streets split into four districts,
// with buildings, parks, palms, lamps, the harbour water, the beach, the Spray Shop
// and every story location. Deterministic from the seed, so screenshots repeat.
//
// Revision notes (this session): Downtown now has a central plaza with a fountain
// (plazas[]), and isSidewalk(x, y) answers whether a point is walkable pavement —
// pedestrians and pickups use it instead of guessing from the road width.

import { DISTRICTS, PALETTE, ROADS, WORLD } from './config.js';

const WATER_WEST = 150; // harbour strip along the west edge
const SAND_EAST = 3300; // beach strip along the east edge

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function districtAt(x, y) {
  if (x < 700) return 'Pelabuhan';
  if (x >= SAND_EAST) return 'Pantai Coral';
  if (y >= 1850) return 'Suburb';
  if (x >= 1100 && x <= 2300 && y >= 650 && y <= 1450) return 'Downtown';
  return 'Solmar';
}

/** Build the whole static city from the seeded random. */
export function createCity(random) {
  const { avenues, streets, width, sidewalk } = ROADS;
  const buildings = [];
  const lamps = [];
  const palms = [];
  const parks = [];

  // One block = the ground between two neighbouring roads. Fill most blocks with
  // buildings, leave some as parks or parking lots so the city breathes.
  const xs = [0, ...avenues, WORLD.width];
  const ys = [0, ...streets, WORLD.height];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + (bx === 0 ? WATER_WEST : width / 2 + sidewalk);
      const x1 = xs[bx + 1] - (bx === xs.length - 2 ? WORLD.width - SAND_EAST : width / 2 + sidewalk);
      const y0 = ys[by] + (by === 0 ? 0 : width / 2 + sidewalk);
      const y1 = ys[by + 1] - (by === ys.length - 2 ? 0 : width / 2 + sidewalk);
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 60 || bh < 60) continue;
      const cx = x0 + bw / 2;
      const cy = y0 + bh / 2;
      const district = districtAt(cx, cy);
      const roll = random();
      if (roll < 0.12) {
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        continue;
      }
      if (district === 'Pantai Coral' || district === 'Pelabuhan' && bx === 0) continue;
      const tall = district === 'Downtown';
      const house = district === 'Suburb';
      const warehouse = district === 'Pelabuhan';
      const roof = tall ? pick(random, PALETTE.downtownRoof)
        : house ? pick(random, PALETTE.houseRoof)
        : warehouse ? pick(random, PALETTE.warehouseRoof)
        : pick(random, PALETTE.buildingRoof);
      const cols = house || warehouse ? 2 : tall ? 1 : 2;
      const rows = house ? 2 : 1;
      const gap = 14;
      const cellW = (bw - gap * (cols + 1)) / cols;
      const cellH = (bh - gap * (rows + 1)) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (random() < 0.15) continue;
          const w = cellW * (0.72 + random() * 0.26);
          const h = cellH * (0.72 + random() * 0.26);
          buildings.push({
            x: x0 + gap + c * (cellW + gap) + (cellW - w) / 2,
            y: y0 + gap + r * (cellH + gap) + (cellH - h) / 2,
            w, h, roof,
            height: tall ? 3 + Math.floor(random() * 4) : house ? 1 : warehouse ? 1 : 1 + Math.floor(random() * 2),
            district,
          });
        }
      }
    }
  }

  // Central plaza in Downtown (avenue 1900 x street 1050 block): open pavement
  // with a fountain, a landmark the player walks through on mission 1.
  const plazas = [{ x: 1748, y: 898, w: 304, h: 304, name: 'Plaza Solmar' }];

  // Street lamps along every avenue and street, on alternating sides.
  for (const ax of avenues) {
    for (const sy of streets) {
      lamps.push({ x: ax + width / 2 + 8, y: sy - width / 2 - 8 });
      lamps.push({ x: ax - width / 2 - 8, y: sy + width / 2 + 8 });
    }
  }
  // Palms along the beach and a few in the parks.
  for (let y = 120; y < WORLD.height; y += 130) {
    palms.push({ x: SAND_EAST + 30 + random() * 90, y: y + random() * 40 });
    if (random() < 0.5) palms.push({ x: SAND_EAST + 130 + random() * 60, y: y + 60 });
  }
  for (const park of parks) {
    const n = 2 + Math.floor(random() * 3);
    for (let i = 0; i < n; i += 1) {
      palms.push({ x: park.x + 20 + random() * (park.w - 40), y: park.y + 20 + random() * (park.h - 40) });
    }
  }

  // Traffic lights: one per intersection, alternating phase by checkerboard.
  const lights = [];
  for (const ax of avenues) {
    for (const sy of streets) {
      lights.push({ x: ax, y: sy, phase: ((ax + sy) / 100) % 2 === 0 ? 0 : 1 });
    }
  }

  const sprayShop = { x: 1470, y: 2240, w: 110, h: 80, name: 'Spray Shop' };
  const spots = {
    rosaCafe: { x: 1520, y: 690 },
    bank: { x: 730, y: 290 },
    titoCorner: { x: 730, y: 1090 },
    beachBar: { x: 3300, y: 690 },
    hideout: { x: 1930, y: 2290 },
    dock: { x: 350, y: 1890 },
    boat: { x: 170, y: 1890 },
    playerStart: { x: 1500, y: 1050 },
  };

  return {
    buildings, lamps, palms, parks, plazas, lights, sprayShop, spots,
    waterWest: WATER_WEST,
    sandEast: SAND_EAST,
    districtAt,
    isWater(x, y) {
      return x < WATER_WEST || x > WORLD.width - 40;
    },
    isSand(x, y) {
      return x >= SAND_EAST && x <= WORLD.width - 40;
    },
    /** Is this point on a road (not sidewalk)? */
    isRoad(x, y) {
      const half = width / 2;
      for (const ax of avenues) if (Math.abs(x - ax) <= half) return true;
      for (const sy of streets) if (Math.abs(y - sy) <= half) return true;
      return false;
    },
    /** Is this point on the sidewalk ring around a road, or on a plaza? */
    isSidewalk(x, y) {
      if (this.isRoad(x, y)) return false;
      const half = width / 2;
      for (const ax of avenues) {
        if (Math.abs(x - ax) <= half + sidewalk) return true;
      }
      for (const sy of streets) {
        if (Math.abs(y - sy) <= half + sidewalk) return true;
      }
      return plazas.some((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
    },
    /** Nearest point on a road centreline, for spawning traffic and the player. */
    nearestRoad(x, y) {
      let best = null;
      let bestD = Infinity;
      for (const ax of avenues) {
        const d = Math.abs(x - ax);
        if (d < bestD) { bestD = d; best = { x: ax, y, axis: 'v' }; }
      }
      for (const sy of streets) {
        const d = Math.abs(y - sy);
        if (d < bestD) { bestD = d; best = { x, y: sy, axis: 'h' }; }
      }
      return best;
    },
    /** Traffic-light state at global time t: 'ns' means north-south green. */
    lightState(t) {
      const cycle = 14;
      return (Math.floor(t / cycle) % 2 === 0) ? 'ns' : 'ew';
    },
    /** Seconds until the light state flips, so traffic can slow for amber. */
    lightTimeLeft(t) {
      const cycle = 14;
      return cycle - (t % cycle);
    },
    /** Push a circle out of every building it overlaps; returns true on a hit. */
    resolveCircle(body, radius) {
      let hit = false;
      for (const b of buildings) {
        const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
        const dx = body.x - cx;
        const dy = body.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          hit = true;
          if (d2 > 0.01) {
            const d = Math.sqrt(d2);
            body.x = cx + (dx / d) * radius;
            body.y = cy + (dy / d) * radius;
          } else {
            body.y = b.y - radius;
          }
        }
      }
      return hit;
    },
    /** Clamp a body inside the world and out of the water (except the boat spot). */
    clampWorld(body, radius, allowWater = false) {
      body.x = Math.max(radius, Math.min(WORLD.width - radius, body.x));
      body.y = Math.max(radius, Math.min(WORLD.height - radius, body.y));
      if (!allowWater) {
        if (body.x < WATER_WEST + radius) body.x = WATER_WEST + radius;
        if (body.x > WORLD.width - 40 - radius) body.x = WORLD.width - 40 - radius;
      }
    },
  };
}
