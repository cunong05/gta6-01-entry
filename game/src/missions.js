// Solmar Bay — the story: six chained missions from Mama Rosa, each with a
// marker on the map, a short dialogue, and a cash reward. Rico Vega, a
// freelance driver, works his way up from courier runs to the big score.

import {
  ROSAS_PLACE, HARBOR_PIER, BANK, GARAGE, SAFEHOUSE, SPRAY_SHOP,
} from './config.js';
import { spawnEnemy } from './combat.js';
import { addHeat } from './police.js';

export const MISSIONS = [
  {
    id: 0,
    title: 'First Delivery',
    giver: 'Mama Rosa',
    intro: [
      'Mama Rosa: Rico, mijo. A package needs to reach the old pier before sunset.',
      'Mama Rosa: No questions, no peeking. Drive careful — the harbour road is rough.',
      'Rico: On it. One package, no questions. Just like old times.',
    ],
    outro: [
      'Dockhand: Rosa sends her regards. Here is your cut.',
      'Mama Rosa: See? Easy money. I have more work if you want it.',
    ],
    reward: 150,
    objective: 'Deliver the package to the old pier',
  },
  {
    id: 1,
    title: 'The Pickup',
    giver: 'Mama Rosa',
    intro: [
      'Mama Rosa: My nephew Tico is waiting at the pier. He needs a ride downtown.',
      'Mama Rosa: He is carrying something fragile. Do NOT hit anything. Capisce?',
      'Rico: Tico, fragile cargo, downtown. Got it.',
    ],
    outro: [
      'Tico: You drive like my abuela, but we made it in one piece. Thanks, Rico!',
      'Mama Rosa: Good. The downtown crew noticed. They want a driver.',
    ],
    reward: 250,
    objective: 'Pick up Tico at the pier, then drive him downtown',
  },
  {
    id: 2,
    title: 'Hot Wheels',
    giver: 'Mama Rosa',
    intro: [
      'Mama Rosa: A gold sportscar is parked by the chop garage. It belongs to nobody now.',
      'Mama Rosa: Bring it to the garage and the boys will pay you well. Quietly.',
      'Rico: A gold sportscar, no owner, good money. I like this job already.',
    ],
    outro: [
      'Garage Boss: Clean title? Never mind. Here is your cut, driver.',
      'Mama Rosa: You are moving up, Rico. But the cops are watching now.',
    ],
    reward: 400,
    objective: 'Steal the gold sportscar and deliver it to the Chop Garage',
  },
  {
    id: 3,
    title: 'Heat on the Street',
    giver: 'Mama Rosa',
    intro: [
      'Mama Rosa: The police put your face on the board, Rico. Three stars!',
      'Mama Rosa: Get to the Spray Shop on Coral Avenue. New paint, new car, clean slate.',
      'Rico: Three stars and a paint job. Time to disappear.',
    ],
    outro: [
      'Spray Shop: Fresh coat, fresh plates. Even your mother would not know this car.',
      'Mama Rosa: See? In Solmar Bay, every problem has a price tag.',
    ],
    reward: 500,
    objective: 'Lose the cops — repaint the car at the Spray Shop',
  },
  {
    id: 4,
    title: 'Dockside Trouble',
    giver: 'Mama Rosa',
    intro: [
      'Mama Rosa: The harbour crew is shaking down my fishermen. Three of them, armed.',
      'Mama Rosa: Take your pistol. Send them home — or send them swimming.',
      'Rico: Dockside trouble? I will handle it.',
    ],
    outro: [
      'Fisherman: You saved our boats, Rico. The harbour owes you one.',
      'Mama Rosa: One last job, mijo. The big one. Are you ready?',
    ],
    reward: 700,
    objective: 'Deal with the three armed thugs at the docks',
  },
  {
    id: 5,
    title: 'The Big Score',
    giver: 'Mama Rosa',
    intro: [
      'Mama Rosa: The Solmar Bay Bank moves its cash at noon. One van, one driver.',
      'Mama Rosa: Grab the cash, lose the heat, and bring it home to the safehouse.',
      'Rico: The bank, the cash, the safehouse. Let us finish this.',
    ],
    outro: [
      'Rico: We did it. The whole bay is talking about us tonight.',
      'Mama Rosa: You are a legend now, mijo. Solmar Bay is yours.',
    ],
    reward: 1500,
    objective: 'Grab the bank cash, then escape to the safehouse',
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function currentMission(world) {
  if (world.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[world.missionIndex];
}

export function currentObjective(world) {
  const m = currentMission(world);
  if (!m) return 'Free roam — Solmar Bay is yours. Spend your cash, steal cars, stay free.';
  return `${m.title}: ${m.objective}`;
}

// Where the yellow marker points right now, or null.
export function missionMarker(world) {
  const m = currentMission(world);
  if (!m) return null;
  const s = world.missionStage;
  switch (m.id) {
    case 0: return { x: HARBOR_PIER.x + 40, y: HARBOR_PIER.y + 13, label: 'Deliver the package' };
    case 1:
      if (s === 'pickup') return { x: HARBOR_PIER.x + 40, y: HARBOR_PIER.y + 13, label: 'Pick up Tico' };
      return { x: 1600, y: 1200, label: 'Drop Tico downtown' };
    case 2:
      if (s === 'steal') return { x: world.hotCar.x, y: world.hotCar.y, label: 'The gold sportscar' };
      return { x: GARAGE.x + GARAGE.w / 2, y: GARAGE.y + GARAGE.h / 2, label: 'Chop Garage' };
    case 3: return { x: SPRAY_SHOP.x + SPRAY_SHOP.w / 2, y: SPRAY_SHOP.y + SPRAY_SHOP.h / 2, label: 'Spray Shop' };
    case 4: return { x: HARBOR_PIER.x + 40, y: HARBOR_PIER.y + 13, label: 'Clear the docks' };
    case 5:
      if (s === 'bank') return { x: BANK.x + BANK.w / 2, y: BANK.y + BANK.h / 2, label: 'Solmar Bay Bank' };
      return { x: SAFEHOUSE.x + SAFEHOUSE.w / 2, y: SAFEHOUSE.y + SAFEHOUSE.h / 2, label: 'Safehouse' };
    default: return null;
  }
}

export function startMission(world, index) {
  const m = MISSIONS[index];
  if (!m) return;
  world.missionIndex = index;
  world.missionStage = 'start';
  world.missionTimer = 0;
  // Per-mission setup.
  if (m.id === 1) {
    world.missionStage = 'pickup';
    world.passenger = { x: HARBOR_PIER.x + 40, y: HARBOR_PIER.y + 13, inCar: false, name: 'Tico' };
  } else if (m.id === 2) {
    world.missionStage = 'steal';
    if (!world.hotCar) {
      world.hotCar = {
        x: 1850, y: 1060, angle: 0, speed: 0, type: 5, name: 'Sport', w: 48, h: 21,
        topSpeed: 470, accel: 340, color: '#ffd94a', axis: 'h', road: 1650, dir: 1,
        lane: 1, cruise: 0, isPolice: false, isPlayer: false, parked: true, hot: true,
      };
      world.parkedCars.push(world.hotCar);
    }
  } else if (m.id === 3) {
    world.missionStage = 'escape';
    addHeat(world, 3, 'framed by the harbour crew');
    world.message('The cops are onto you! Get to the Spray Shop!', 4);
  } else if (m.id === 4) {
    world.missionStage = 'fight';
    const spots = [
      { x: HARBOR_PIER.x + 30, y: HARBOR_PIER.y - 60 },
      { x: HARBOR_PIER.x + 90, y: HARBOR_PIER.y + 40 },
      { x: HARBOR_PIER.x - 60, y: HARBOR_PIER.y + 30 },
    ];
    for (const s of spots) spawnEnemy(world, s.x, s.y, { hp: 70, gun: true });
  } else if (m.id === 5) {
    world.missionStage = 'bank';
  }
  world.showDialog(m.giver, m.intro);
  world.audio.pickup();
}

function completeMission(world) {
  const m = currentMission(world);
  if (!m) return;
  world.money += m.reward;
  world.totalEarned += m.reward;
  world.message(`Mission complete: ${m.title}  +$${m.reward}`, 4);
  world.audio.missionComplete();
  world.showDialog(m.giver, m.outro);
  world.missionIndex += 1;
  world.missionStage = 'done';
  world.passenger = null;
  world.saveGame();
  if (world.missionIndex >= MISSIONS.length) {
    world.storyComplete = true;
    world.state = 'win';
  } else {
    // A short breather, then the next job calls.
    world.nextMissionTimer = 3;
  }
}

function near(world, x, y, dist = 70) {
  const p = world.playerCar || world.player;
  return Math.hypot(p.x - x, p.y - y) < dist;
}

export function updateMissions(world, dt) {
  const m = currentMission(world);
  if (!m) return;

  // The next job starts a few seconds after the last one ends.
  if (world.missionStage === 'done' && world.nextMissionTimer > 0) {
    world.nextMissionTimer -= dt;
    if (world.nextMissionTimer <= 0) startMission(world, world.missionIndex);
    return;
  }

  switch (m.id) {
    case 0:
      if (near(world, HARBOR_PIER.x + 40, HARBOR_PIER.y + 13)) completeMission(world);
      break;
    case 1:
      if (world.missionStage === 'pickup') {
        if (near(world, HARBOR_PIER.x + 40, HARBOR_PIER.y + 13, 60)) {
          world.missionStage = 'deliver';
          if (world.passenger) world.passenger.inCar = true;
          world.message('Tico is with you. Get him downtown, in one piece!', 3.5);
          world.audio.pickup();
        }
      } else if (near(world, 1600, 1200)) {
        completeMission(world);
      }
      break;
    case 2:
      if (world.missionStage === 'steal') {
        if (world.playerCar === world.hotCar) {
          world.missionStage = 'deliver';
          world.message('That is the one! Now get it to the Chop Garage.', 3.5);
          addHeat(world, 1, 'stole the gold sportscar');
        }
      } else if (world.playerCar === world.hotCar
        && Math.hypot(world.playerCar.x - (GARAGE.x + GARAGE.w / 2), world.playerCar.y - (GARAGE.y + GARAGE.h / 2)) < 130) {
        // Hand the car over: leave it parked in the garage.
        world.parkedCars.push(world.playerCar);
        world.playerCar.parked = true;
        world.playerCar.x = GARAGE.x + 40;
        world.playerCar.y = GARAGE.y + 55;
        world.playerCar.speed = 0;
        world.exitCar();
        completeMission(world);
      }
      break;
    case 3:
      if (world.wantedStars === 0) completeMission(world);
      break;
    case 4:
      if (world.enemies.length === 0) completeMission(world);
      break;
    case 5:
      if (world.missionStage === 'bank') {
        if (near(world, BANK.x + BANK.w / 2, BANK.y + BANK.h / 2, 90)) {
          world.missionStage = 'escape';
          addHeat(world, 4, 'robbed the Solmar Bay Bank');
          world.message('Cash grabbed! Four stars! Lose them and get home!', 4);
          world.audio.cash();
        }
      } else if (near(world, SAFEHOUSE.x + SAFEHOUSE.w / 2, SAFEHOUSE.y + SAFEHOUSE.h / 2, 100)) {
        completeMission(world);
      }
      break;
    default:
      break;
  }
}
