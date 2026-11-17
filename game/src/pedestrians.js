// Pedestrians: walkers on the sidewalks who stroll the grid, cross at intersections
// and run from gunfire or a car bearing down on them. They are the city breathing.
import { PEDS, ROADS, WORLD } from './config.js';

const SHIRTS = ['#e8e0d0', '#d05a4a', '#4a7ad0', '#e8c94a', '#7ad04a', '#c94ad0', '#4ad0c9', '#e8a04a'];
const SKINS = ['#e8b88a', '#c98a5a', '#8a5a3a', '#f0c8a0', '#a06a42'];

/** A walker: strolls along sidewalk lines; dir 0 east, 1 south, 2 west, 3 north. */
export function createPedestrian(random, x, y) {
  return {
    x, y,
    dir: Math.floor(random() * 4),
    speed: PEDS.speed * (0.8 + random() * 0.5),
    shirt: SHIRTS[Math.floor(random() * SHIRTS.length)],
    skin: SKINS[Math.floor(random() * SKINS.length)],
    flee: 0,
    fleeX: 0,
    fleeY: 0,
    walkPhase: random() * Math.PI * 2,
    active: true,
  };
}

function nearestRoadLine(value, lines) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

export function spawnPedestrians(city, random, count, avoidX, avoidY) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 30) {
    guard += 1;
    const vertical = random() < 0.5;
    const road = vertical
      ? ROADS.avenues[Math.floor(random() * ROADS.avenues.length)]
      : ROADS.streets[Math.floor(random() * ROADS.streets.length)];
    const along = 100 + random() * (vertical ? WORLD.height - 200 : WORLD.width - 200);
    const side = (random() < 0.5 ? -1 : 1) * (ROADS.width / 2 + ROADS.sidewalk / 2);
    const x = vertical ? road + side : along;
    const y = vertical ? along : road + side;
    if (Math.hypot(x - avoidX, y - avoidY) < 260) continue;
    if (city.isWater(x, y)) continue;
    peds.push(createPedestrian(random, x, y));
  }
  return peds;
}

/** One walker: follow the sidewalk, turn at intersections, flee danger. */
export function updatePedestrian(ped, city, dt, random, danger) {
  if (!ped.active) return;
  ped.walkPhase += dt * 8;
  let dir = ped.dir;
  let speed = ped.speed;
  if (danger && Math.hypot(danger.x - ped.x, danger.y - ped.y) < danger.radius) {
    ped.flee = 1.2;
    ped.fleeX = danger.x;
    ped.fleeY = danger.y;
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
    ped.x += Math.cos(away) * ped.speed * 2.4 * dt;
    ped.y += Math.sin(away) * ped.speed * 2.4 * dt;
    ped.dir = Math.abs(Math.cos(away)) > Math.abs(Math.sin(away))
      ? (Math.cos(away) > 0 ? 0 : 2)
      : (Math.sin(away) > 0 ? 1 : 3);
    city.clampWorld(ped, 10);
    return;
  }
  const dirs = [
    { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
  ];
  const d = dirs[dir];
  ped.x += d.dx * speed * dt;
  ped.y += d.dy * speed * dt;
  // At an intersection, sometimes turn; at the city edge, turn back.
  const onAvenue = ROADS.avenues.some((ax) => Math.abs(ped.x - ax) < 14);
  const onStreet = ROADS.streets.some((sy) => Math.abs(ped.y - sy) < 14);
  if ((dir === 0 || dir === 2) && onAvenue && random() < 0.02) {
    ped.dir = random() < 0.5 ? 1 : 3;
    ped.y = nearestRoadLine(ped.y, ROADS.streets) + (ped.dir === 1 ? 1 : -1) * (ROADS.width / 2 + ROADS.sidewalk / 2);
  } else if ((dir === 1 || dir === 3) && onStreet && random() < 0.02) {
    ped.dir = random() < 0.5 ? 0 : 2;
    ped.x = nearestRoadLine(ped.x, ROADS.avenues) + (ped.dir === 0 ? 1 : -1) * (ROADS.width / 2 + ROADS.sidewalk / 2);
  }
  if (ped.x < 180) ped.dir = 0;
  if (ped.x > WORLD.width - 60) ped.dir = 2;
  if (ped.y < 30) ped.dir = 1;
  if (ped.y > WORLD.height - 30) ped.dir = 3;
  city.clampWorld(ped, 10);
}
