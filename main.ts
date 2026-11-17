// Solmar Bay — the entry program (Node 22, standard library only).
// It copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with the kit's buildDossier,
// exactly as the bounty requires. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, readGameTree } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir)) {
  throw new Error('game/: no such directory — the game must live in game/');
}
if (!existsSync(shotsDir)) {
  throw new Error('screenshots/: no such directory — add 3 or 4 screenshots');
}

// A clean output directory, so a second run writes exactly the same bytes.
// Empty the directory's CONTENTS without removing the directory itself:
// the grader mounts /output on a read-only root, so rmdir on it fails EACCES.
mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
  rmSync(join(outDir, entry), { recursive: true, force: true });
}

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);

// A short summary of what was handed in, so a failed run says why.
const tree = readGameTree(join(outDir, 'game'), { game_max_files: 993, game_max_bytes: 50331648 });
const sources = tree.files.filter((f) => f.cls === 'source').length;
console.log(`Solmar Bay handed in: ${outDir}`);
console.log(`  game/: ${tree.count} entries, ${tree.totalBytes} bytes (${sources} source files)`);
console.log(`  dossier.json ${dossier.length} bytes`);
