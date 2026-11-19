# SOLMAR CITY — Sunset Getaway

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/cassian27/make-fun-gta6-01-solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/cassian27/make-fun-gta6-01-solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR CITY — Sunset Getaway** is an original top-down open-world crime game built for make.fun's "Make GTA 6" bounty. Everything in it — the city, characters, vehicles, names, story, art, sound and music — is original; nothing is taken from Rockstar Games or any commercial game.

You play Ricky Solis, a getaway driver working for Lena Cruz, the garage fixer who runs Solmar's underground. Solmar City is a sun-soaked coastal city of roads, buildings, parks, a beach and a harbour, with seven named story places: Lena's Garage, the Safehouse, Solmar Harbor, Starlight Casino, the Old Warehouse, Solmar General, and Palm Bank.

## How to play

Open `game/index.html` in a desktop browser, or serve the `game/` folder with any static server (see "Run it" below). No build step, no network requests, no assets to download — the game runs entirely from its own files.

### Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrow keys | Walk on foot, or drive when in a car |
| Mouse | Aim on foot |
| Click (hold) | Shoot |
| E | Enter / steal a car, or get out |
| Space | Handbrake while driving |
| P or Esc | Pause |
| M | Mute |
| Enter | Start / restart |

### Features

- **Open city (3600×2600)** — a road grid with 32 buildings, parks, beach, sea and harbour
- **On foot and by car** — arcade car physics, traffic cars driving the road grid, pedestrians who stroll and flee from gunfire, parked cars to steal
- **Wanted system (0–5 stars)** — stealing cars, shooting, hitting pedestrians and wrecking police cars raise the heat; police cars chase and ram, foot cops shoot back; heat fades if you stay quiet and unseen, and the safehouse clears it
- **5 story missions** — Hot Wheels, Payday Run, Heat Wave, Harbor Job, and The Star Job (a casino heist), each with on-screen objectives, a pulsing map marker and a cash reward; free roam after the story
- **Combat** — mouse-aimed shooting, bullets blocked by buildings; police cars and cops can be wrecked or shot down
- **HUD** — cash, score, mission title and objective, wanted stars, health bar, speed, and a minimap (roads, player, police, mission marker), plus mission banners
- **Save** — cash, score and mission reached persist in localStorage, along with the best score
- **Sound** — fully synthesised WebAudio: engine hum, police sirens, gunshots, pickups, crashes, explosions, mission jingles and a bassline — no audio files
- **Screens** — title, pause and busted screens, with screen-reader status announcements

## Run it

```sh
# Option 1: open the file directly
# (open game/index.html in a desktop browser)

# Option 2: any static server, from inside game/
npx serve game/
# or
python3 -m http.server
```

Then open the served address in a desktop browser and play.

## Entry

Built for the make.fun **"Make GTA 6"** bounty (`gta6-01`). The repository entrypoint is `main.ts` at the root: it copies `game/` and `screenshots/` and writes `output/dossier.json` via the kit's unchanged `vendor/makefun-game.ts`. Screenshots in `screenshots/` are real renders of the game's own code (seed 7, `?shot=1..4`).
