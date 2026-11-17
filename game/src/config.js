// Solmar Bay — every tuning number, colour and story constant in one place.
// The city is a fixed 3600 x 2600 world; the camera follows the player, so no rule
// below depends on the screen size. All names, people and places are original.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** World size in pixels (top-down). */
export const WORLD = { width: 3600, height: 2600 };

/** Road layout: avenues run north-south, streets east-west. */
export const ROADS = {
  avenues: [300, 700, 1100, 1500, 1900, 2300, 2700, 3100],
  streets: [250, 650, 1050, 1450, 1850, 2250],
  width: 96,
  sidewalk: 26,
  lane: 24,
};

/** Districts, by region: port west, downtown centre, beach east, suburb south. */
export const DISTRICTS = [
  { name: 'Pelabuhan', x0: 0, y0: 0, x1: 700, y1: 2600 },
  { name: 'Downtown', x0: 1100, y1: 1450, x1: 2300, y0: 650 },
  { name: 'Pantai Coral', x0: 3100, y0: 0, x1: 3600, y1: 2600 },
  { name: 'Suburb', x0: 0, y0: 1850, x1: 3600, y1: 2600 },
];

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 300,
  health: 100,
  startMoney: 150,
  startAmmo: 24,
  punchDamage: 25,
  punchRange: 34,
  punchArc: 1.1,
};

export const CAR = {
  length: 46,
  width: 24,
  radius: 22,
  accel: 420,
  brake: 700,
  reverseMax: 160,
  maxSpeed: 520,
  policeMaxSpeed: 560,
  turnRate: 2.6,
  drag: 0.55,
  crashDamageSpeed: 320,
};

export const TRAFFIC = { count: 40, speed: 150, minGap: 78 };
export const PEDS = { count: 48, speed: 55 };

export const WANTED = {
  max: 5,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  decaySeconds: 26,
  sprayCostPerStar: 100,
};

export const POLICE = {
  maxCars: 6,
  maxCops: 8,
  spawnDistance: 700,
  ramDamage: 8,
  copPunchDamage: 6,
  copShootRange: 320,
};

export const BULLET = { speed: 900, life: 0.9, damage: 34, radius: 4 };

export const PICKUPS = {
  cash: { value: 60 },
  ammo: { amount: 12 },
  health: { amount: 35 },
};

export const DAY = { cycleSeconds: 300, start: 0.32 };

export const PALETTE = {
  grass: '#5d8a4a',
  park: '#4c7a3e',
  sand: '#e0c98f',
  water: '#2f7fa8',
  deepWater: '#256b8f',
  road: '#3a3f46',
  roadEdge: '#2c3036',
  lane: '#d8c95a',
  sidewalk: '#8d8f94',
  plaza: '#7a7d84',
  buildingRoof: ['#b0563f', '#4f6d8a', '#7a5a8a', '#8a6d4f', '#5a8a6d', '#9a8a6a'],
  downtownRoof: ['#3f5a78', '#5a4a6d', '#6d5a3f', '#46586b'],
  houseRoof: ['#a8543f', '#7a6a4f', '#5a7a8a', '#8a4f5a'],
  warehouseRoof: ['#6d7a80', '#7a6d5a', '#5a6d6d'],
  lamp: '#ffd98a',
  sprayShop: '#e8b23a',
  marker: '#ffcf3f',
  player: '#2fae5f',
  playerCar: '#e84c3d',
  policeCar: '#2f6fd0',
  policeLightRed: '#ff2f2f',
  policeLightBlue: '#2f7fff',
  text: '#f2f4f6',
  muted: '#aab2bb',
  panel: 'rgba(12, 16, 22, 0.78)',
  danger: '#ff5a4d',
  money: '#7be382',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';

/** The six chained story missions. Every name is original. */
export const MISSIONS = [
  {
    name: 'Paket untuk Rosa',
    giver: 'Mama Rosa',
    brief: 'Antar paket ke kafe Mama Rosa di Downtown. Jangan sampai paketnya basah.',
    reward: 150,
    stages: [{ kind: 'goto', x: 1520, y: 690, radius: 60, label: 'Kafe Mama Rosa' }],
  },
  {
    name: 'Jemput Tito',
    giver: 'Mama Rosa',
    brief: 'Tito menunggu di sudut Pelabuhan. Jemput dia, lalu antar ke Bar Coral di pantai.',
    reward: 250,
    stages: [
      { kind: 'goto', x: 730, y: 1090, radius: 55, label: 'Tito menunggu' },
      { kind: 'goto', x: 3300, y: 690, radius: 60, label: 'Bar Coral' },
    ],
  },
  {
    name: 'Kejar si Pengkhianat',
    giver: 'Tito',
    brief: 'Marco kabur bawa uang kas. Kejar mobilnya dan tabrak sampai berhenti!',
    reward: 400,
    stages: [{ kind: 'chase', label: 'Tabrak mobil Marco' }],
  },
  {
    name: 'Kabur dari Polisi',
    giver: 'Mama Rosa',
    brief: 'Polisi mengepungmu! Bertahan 30 detik, lalu sembunyi di markas Suburb.',
    reward: 500,
    stages: [
      { kind: 'survive', seconds: 30, label: 'Bertahan dari kejaran' },
      { kind: 'goto', x: 1930, y: 2290, radius: 60, label: 'Markas Suburb' },
    ],
  },
  {
    name: 'Rampok Bank Pelabuhan',
    giver: 'Tito',
    brief: 'Masuk bank, tahan 8 detik sampai brankas terbuka, lalu kabur ke Spray Shop.',
    reward: 800,
    stages: [
      { kind: 'goto', x: 730, y: 290, radius: 55, label: 'Bank Pelabuhan' },
      { kind: 'wait', seconds: 8, x: 730, y: 290, radius: 70, label: 'Buka brankas...' },
      { kind: 'goto', x: 1520, y: 2290, radius: 70, label: 'Spray Shop — hapus jejak' },
    ],
  },
  {
    name: 'Akhir di Pelabuhan',
    giver: 'Mama Rosa',
    brief: 'Ini yang terakhir, Rico. Ke dermaga, hadapi penjaga Marco, naik ke kapal.',
    reward: 1500,
    stages: [
      { kind: 'goto', x: 350, y: 1890, radius: 70, label: 'Dermaga Pelabuhan' },
      { kind: 'kill', count: 4, x: 350, y: 1890, radius: 260, label: 'Kalahkan 4 penjaga' },
      { kind: 'goto', x: 170, y: 1890, radius: 55, label: 'Naik ke kapal' },
    ],
  },
];

export const STORY_END =
  'Rico menatap matahari terbenam di Teluk Solmar. Uang kas kembali, Marco kabur, ' +
  'dan Mama Rosa sudah menyiapkan makan malam. Solmar Bay tetap milik mereka.';
