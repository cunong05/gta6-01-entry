// Cars: creation, player driving physics, and the traffic AI. Traffic cars keep to
// their lane on the road grid, stop at red lights and behind the car ahead, and pick
// a new direction at intersections. Police cars are driven by police.js, not here.
import { CAR, ROADS, TRAFFIC, WORLD } from './config.js';

const COLORS = ['#c94f43', '#3f6d9e', '#c9a13f', '#5a8a5f', '#8a5a9e', '#d8d8d8', '#3a3a3a', '#9e6d3f'];

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A car: kind is 'traffic', 'police' or 'player'. angle 0 = east, grows clockwise. */
let nextCarId = 1;
export function createCar(kind, x, y, angle, color) {
  return {
    id: nextCarId++,
    kind, x, y, angle,
    speed: 0,
    color: color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
    hp: 100,
    dir: 0, // traffic AI: 0 east, 1 south, 2 west, 3 north
    wait: 0,
    stopped: false,
    active: true,
    siren: 0,
    targetHp: 0, // mission chase target health; 0 = not a target
    driver: null, // 'marco' for the mission target car
  };
}

function laneOffset(dir) {
  // Right-hand traffic: the lane sits to the right of the direction of travel.
  return ROADS.lane;
}

/** Where a traffic car wants to be: its road centreline plus its lane offset. */
function lanePoint(car) {
  const off = laneOffset(car.dir);
  if (car.dir === 0) return { x: car.x, y: nearestStreet(car.y) + off, axis: 'h' };
  if (car.dir === 2) return { x: car.x, y: nearestStreet(car.y) - off, axis: 'h' };
  if (car.dir === 1) return { x: nearestAvenue(car.x) - off, y: car.y, axis: 'v' };
  return { x: nearestAvenue(car.x) + off, y: car.y, axis: 'v' };
}

function nearestAvenue(x) {
  let best = ROADS.avenues[0];
  for (const ax of ROADS.avenues) if (Math.abs(ax - x) < Math.abs(best - x)) best = ax;
  return best;
}
function nearestStreet(y) {
  let best = ROADS.streets[0];
  for (const sy of ROADS.streets) if (Math.abs(sy - y) < Math.abs(best - y)) best = sy;
  return best;
}

function nextIntersection(car) {
  const { avenues, streets } = ROADS;
  if (car.dir === 0) {
    for (const ax of avenues) if (ax > car.x + 10) return { x: ax, y: nearestStreet(car.y) };
  }
  if (car.dir === 2) {
    for (let i = avenues.length - 1; i >= 0; i -= 1) {
      if (avenues[i] < car.x - 10) return { x: avenues[i], y: nearestStreet(car.y) };
    }
  }
  if (car.dir === 1) {
    for (const sy of streets) if (sy > car.y + 10) return { x: nearestAvenue(car.x), y: sy };
  }
  if (car.dir === 3) {
    for (let i = streets.length - 1; i >= 0; i -= 1) {
      if (streets[i] < car.y - 10) return { x: nearestAvenue(car.x), y: streets[i] };
    }
  }
  return null;
}

/** Spawn traffic spread over the roads, away from the player start. */
export function spawnTraffic(city, random, count, avoidX, avoidY) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 40) {
    guard += 1;
    const vertical = random() < 0.5;
    const road = vertical
      ? ROADS.avenues[Math.floor(random() * ROADS.avenues.length)]
      : ROADS.streets[Math.floor(random() * ROADS.streets.length)];
    const along = 120 + random() * (vertical ? WORLD.height - 240 : WORLD.width - 240);
    const dir = vertical ? (random() < 0.5 ? 1 : 3) : (random() < 0.5 ? 0 : 2);
    const x = vertical ? road : along;
    const y = vertical ? along : road;
    if (Math.hypot(x - avoidX, y - avoidY) < 500) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 120)) continue;
    const car = createCar('traffic', x, y, [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir]);
    car.dir = dir;
    car.speed = TRAFFIC.speed * (0.85 + random() * 0.3);
    cars.push(car);
  }
  return cars;
}

/** One traffic car: follow its lane, obey lights, keep a gap, turn at intersections. */
export function updateTrafficCar(car, city, dt, cars, random, time) {
  if (!car.active) return;
  const dirs = [
    { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 0, dy: -1 },
  ];
  const d = dirs[car.dir];
  const targetAngle = Math.atan2(d.dy, d.dx);
  car.angle += Math.max(-3 * dt, Math.min(3 * dt, angleDiff(car.angle, targetAngle)));

  // Stop line: red light for my axis, or a car close ahead.
  let wantSpeed = TRAFFIC.speed;
  const next = nextIntersection(car);
  if (next) {
    const dist = Math.hypot(next.x - car.x, next.y - car.y);
    const axis = car.dir === 0 || car.dir === 2 ? 'ew' : 'ns';
    const green = city.lightState(time) === axis;
    if (!green && dist < 110 && dist > 20) wantSpeed = 0;
  }
  for (const other of cars) {
    if (other === car || !other.active) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * d.dx + dy * d.dy;
    const side = Math.abs(dx * -d.dy + dy * d.dx);
    if (ahead > 0 && ahead < TRAFFIC.minGap && side < 30) {
      wantSpeed = Math.min(wantSpeed, Math.max(0, other.speed - 20));
    }
  }
  car.speed += Math.max(-300 * dt, Math.min(200 * dt, wantSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Reached an intersection: pick a new direction (never a U-turn).
  if (next && Math.hypot(next.x - car.x, next.y - car.y) < 26) {
    const options = [0, 1, 2, 3].filter((o) => o !== (car.dir + 2) % 4);
    const edge = (car.dir === 0 && next.x >= ROADS.avenues[ROADS.avenues.length - 1])
      || (car.dir === 2 && next.x <= ROADS.avenues[0])
      || (car.dir === 1 && next.y >= ROADS.streets[ROADS.streets.length - 1])
      || (car.dir === 3 && next.y <= ROADS.streets[0]);
    if (edge) {
      car.dir = (car.dir + 2) % 4; // at the city edge, turn back
    } else if (random() < 0.55) {
      car.dir = options[Math.floor(random() * options.length)];
    }
    // Snap onto the new road's centreline so turns stay on the grid.
    const lp = lanePoint(car);
    if (car.dir === 0 || car.dir === 2) car.y = lp.y;
    else car.x = lp.x;
  }
  city.clampWorld(car, CAR.radius);
}

/** Player driving: W/S accelerate and brake, A/D steer, Space handbrakes. */
export function drivePlayerCar(car, move, dt, handbrake) {
  const forward = -move.y; // W is up = forward
  const steer = move.x;
  const speedSign = car.speed >= 0 ? 1 : -1;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed += (car.speed > 20 ? -CAR.brake : -CAR.accel * 0.6) * dt;
  }
  if (handbrake) car.speed -= car.speed * 3.5 * dt;
  car.speed -= car.speed * CAR.drag * dt;
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;
  const steerAmount = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 120) * speedSign;
  car.angle += steerAmount;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return Math.abs(steer) > 0.6 && Math.abs(car.speed) > 240;
}

/** Pairs currently in contact, so the speed exchange fires once per bump, not every
 * frame the cars stay touching (that ground them both to a crawl). */
const touching = new Set();

/** Push overlapping cars apart (circle test on the car centres). A rear-end shove
 * hands the speed to the car ahead instead of dragging both to a crawl. */
export function collideCars(cars) {
  const seen = new Set();
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (!a.active) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (!b.active) continue;
      // Police cars never pile up on each other while converging on the player.
      if (a.kind === 'police' && b.kind === 'police') continue;
      // A police car never physically pins the player's car: the ram rule in
      // police.js handles that contact (damage + shove) instead.
      if ((a.isPlayerCar && b.kind === 'police') || (b.isPlayerCar && a.kind === 'police')) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = CAR.radius * 1.6;
      if (dist > 0.01 && dist < min) {
        const push = (min - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        seen.add(key);
        if (!touching.has(key)) {
          touching.add(key);
          const aTowardB = Math.cos(a.angle) * nx + Math.sin(a.angle) * ny;
          const bTowardA = -(Math.cos(b.angle) * nx + Math.sin(b.angle) * ny);
          if (a.speed > b.speed && aTowardB > 0.3) {
            // A rear-ends B: B is shoved forward, A keeps most of its speed.
            b.speed = Math.max(b.speed, a.speed * 0.9);
            a.speed *= 0.9;
          } else if (b.speed > a.speed && bTowardA > 0.3) {
            a.speed = Math.max(a.speed, b.speed * 0.9);
            b.speed *= 0.9;
          } else {
            // Head-on: both slow down together, once.
            const avg = (a.speed + b.speed) / 2;
            a.speed = avg * 0.7;
            b.speed = avg * 0.7;
          }
        }
      }
    }
  }
  for (const key of touching) {
    if (!seen.has(key)) touching.delete(key);
  }
}

/** Nearest drivable car to a point, within maxDist. */
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (!car.active) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
