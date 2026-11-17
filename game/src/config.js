// Solmar Bay — configuration: world size, roads, districts, vehicles, prices.
// One place for every tunable number so the rest of the game reads like a design doc.

export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Road centrelines. Vertical roads run north-south, horizontal roads east-west.
export const V_ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const H_ROADS = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_HALF = 48; // half the asphalt width
export const LANE = 24; // distance from a road centreline to a lane centre

// Water: the harbour bites into the west edge, the sea along the south edge.
export const HARBOR_WATER_X = 140; // everything west of this is sea
export const BEACH_Y = 2050; // sand starts here
export const SEA_Y = 2290; // open water starts here

// Districts, by position. Downtown sits in the middle, the harbour west,
// the beach south, suburbs everywhere else.
export function districtAt(x, y) {
  if (x < 480) return 'harbor';
  if (y > BEACH_Y) return 'beach';
  if (x > 1150 && x < 2150 && y > 750 && y < 1750) return 'downtown';
  return 'suburb';
}

export const DISTRICT_NAMES = {
  harbor: 'Harbor District',
  downtown: 'Downtown',
  beach: 'Solmar Beach',
  suburb: 'Palm Suburbs',
};

// Landmark spots (fixed so missions and screenshots can rely on them).
export const SPRAY_SHOP = { x: 1150, y: 1150, w: 170, h: 100, name: 'Spray Shop' };
export const SAFEHOUSE = { x: 2430, y: 330, w: 130, h: 110, name: 'Rico\u2019s Safehouse' };
export const ROSAS_PLACE = { x: 470, y: 470, w: 150, h: 110, name: 'Mama Rosa\u2019s Caf\u00e9' };
export const HARBOR_PIER = { x: 60, y: 600, w: 90, h: 26 };
export const BANK = { x: 1560, y: 960, w: 190, h: 130, name: 'Solmar Bay Bank' };
export const GARAGE = { x: 2650, y: 1650, w: 170, h: 110, name: 'Chop Garage' };

// Player tuning.
export const PLAYER = {
  radius: 14,
  walkSpeed: 185,
  runSpeed: 265,
  health: 100,
  punchDamage: 14,
  punchRange: 34,
  punchCooldown: 0.32,
  pistolDamage: 34,
  pistolCooldown: 0.24,
  startAmmo: 24,
  startMoney: 60,
};

// Driving tuning.
export const DRIVING = {
  accel: 300,
  brake: 520,
  reverseAccel: 200,
  maxSpeed: 430,
  maxReverse: 150,
  steerRate: 2.6,
  grip: 3.2,
  drag: 0.55,
};

// Vehicle types the city spawns.
export const CAR_TYPES = [
  { name: 'Sedan', w: 46, h: 22, topSpeed: 400, accel: 280, color: '#c94f43' },
  { name: 'Taxi', w: 46, h: 22, topSpeed: 390, accel: 270, color: '#e8b93a' },
  { name: 'Hatchback', w: 42, h: 21, topSpeed: 370, accel: 300, color: '#4f8fc9' },
  { name: 'Pickup', w: 52, h: 23, topSpeed: 380, accel: 260, color: '#7a5a3a' },
  { name: 'Van', w: 56, h: 24, topSpeed: 330, accel: 220, color: '#d8d3c4' },
  { name: 'Sport', w: 48, h: 21, topSpeed: 470, accel: 340, color: '#8a2f6d' },
  { name: 'Truck', w: 64, h: 26, topSpeed: 300, accel: 190, color: '#5a6b52' },
];

// Wanted system.
export const WANTED = {
  maxStars: 5,
  stealCarHeat: 1,
  killHeat: 1,
  shootHeat: 0.5,
  decayPerSecond: 0.045, // heat slowly cools when nobody is chasing
  sprayCostPerStar: 120,
  policeCarPerStar: 1, // +1 patrol car per star
  footCopPerStar: 1,
};

// Money.
export const PRICES = {
  pistolAmmo: 40, // a box of 24 rounds at the corner shop is free in this build: pickups only
  sprayPerStar: 120,
};

// Colours.
export const COLORS = {
  grass: '#5d8a4a',
  grassDark: '#527c40',
  sand: '#e0c98f',
  sea: '#2e7fa8',
  seaDeep: '#256b8f',
  asphalt: '#3c3f45',
  asphaltLight: '#464a52',
  sidewalk: '#9a9a92',
  curb: '#c9c9bd',
  crosswalk: '#d8d8cc',
  buildingRoof: '#7d6a5c',
  downtownRoof: '#5c6b7a',
  houseRoof: '#a85a4a',
  warehouseRoof: '#6b7a6e',
  park: '#4c7a3d',
  player: '#e8c33a',
  police: '#20242c',
};

// Day cycle: one full day lasts this long in seconds of play.
export const DAY_LENGTH = 300;
export const SAVE_KEY = 'solmar-bay-save-v1';
