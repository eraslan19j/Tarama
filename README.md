# The Dragon Knight — Real-Time 3D Character Lab

An interactive, browser-based 3D character study built from the supplied reference images. The knight is an original parametric interpretation of the visual language in those plates: blackened layered plate, scale mail, an open-faced dragon helmet with winged horns and a crimson plume, silver hair, a dragon-sigil shield, a longsword, and a wind-driven cape.

![Dragon Knight studio preview](docs/studio-preview.jpg)

## What is included

- **Procedural 3D character** — a named, articulated hierarchy with 300+ meshes, PBR metals and leather, instanced scale mail, rivets, fur, hair strands, plume strands, shield, sword, and dynamically deforming cape cloth.
- **Small animated world** — a circular dragon-sigil courtyard with flagstones, broken pillars and outer walls, four animated braziers, waving banners, drifting embers, footfall dust, fog, rim lighting, and reflective environment lighting.
- **Locomotion** — Idle, Walk, and Run with smooth transitions, opposing arm/leg swing, knee bend, foot roll, torso twist, body bob, head stabilization, and courtyard patrol.
- **Secondary animation** — separately animated pauldrons, faulds, tassets, plume, hair, fur collar, shield, sword, cape chain, and helmet. Armor flex is adjustable.
- **Cape simulation** — a subdivided cloth mesh with pinned shoulders, wind-driven drag, travelling folds, flutter, and a ragged hem. Cape wind is adjustable.
- **Studio controls** — camera presets, cinematic orbit, equipment toggles, cadence, reference-image lightbox, and keyboard steering.
- **Model export** — a portable `public/models/dragon-knight.glb` with a named rig and Idle / Walk / Run GLTF animation clips, plus an in-app **Export character .glb** button that includes the browser-generated procedural textures.

## Run it

```bash
npm install
npm run dev
```

Then open the live preview or `http://localhost:5173`. The Vite server binds to `0.0.0.0` for the Arena preview environment.

Other commands:

```bash
npm run build          # production bundle
npm run preview        # preview the production build
npm run test:model     # validate geometry, bounds, and animation node bindings
npm run export:glb     # regenerate the standalone GLB asset
```

## Termux

A dedicated installer, shortcodes and troubleshooting notes live in [`termux/README.md`](termux/README.md). Quick start:

```bash
curl -fsSL https://github.com/eraslan19j/Tarama/raw/refs/heads/arena/2b2224d1-tarama/termux/bootstrap.sh \
  | bash -s -- DK3D-2517-TARAMA DRAGON-5173-TERMUX
```

Download code: `DK3D-2517-TARAMA`  
Activation code: `DRAGON-5173-TERMUX`

These are convenience shortcodes, not license keys. Termux and this project require no paid activation.

## Controls

| Action | Control |
| --- | --- |
| Idle / Walk / Run | `1` / `2` / `3`, or the Locomotion buttons |
| Sprint while held | `Shift` |
| Steer manually | `W` `A` `S` `D` (turns off auto patrol) |
| Cape / Helmet / Shield / Sword | `C` / `H` / `B` / `V`, or the Equipment chips |
| Pause / resume | `Space` |
| Hero camera | `R` |
| Orbit / zoom | Drag / scroll on the viewport |
| Reference plates | Click any thumbnail; `Esc` closes |

The control panel also has **Armor flex**, **Cape wind**, **Cadence**, **Auto patrol**, and **Cinematic orbit** controls.

## Exported model

`public/models/dragon-knight.glb` is generated from the same parametric character module used by the live scene. It preserves named nodes such as `Hips`, `Torso`, `LeftLeg`, `RightLeg`, `LeftPauldron`, `AnimatedCrimsonCape`, `DragonShield`, and `ValyrianLongsword`, and embeds three one-second looping clips: `Idle`, `Walk`, and `Run`. The static file is intentionally texture-free for maximum glTF viewer compatibility; the in-app export includes the runtime-generated canvas textures.

`public/models/dragon-knight.info.json` records mesh, vertex, triangle, height, and clip metadata.

## Project layout

```text
index.html                         Studio UI
src/main.js                        Renderer, controls, UI, export, render loop
src/style.css                      Cinematic HUD styling
src/scene/materials.js             PBR material palette
src/scene/textures.js              Procedural metal, stone, sigil, cape, banner textures
src/scene/geometry.js              Plates, tubes, cloth mesh, shape utilities
src/scene/world.js                 Courtyard, ruins, braziers, banners, atmosphere
src/scene/animation.js             Locomotion, secondary motion, cape deformation
src/scene/export.js                GLTF animation clips
src/scene/character/               Body, head/helmet, equipment, rig assembly
public/references/                  Supplied visual reference plates
public/models/                     Generated GLB and metadata
scripts/                           Model validation and GLB generation
termux/                            Termux download, activation and bootstrap scripts
docs/studio-preview.jpg            Rendered studio preview
```

The existing `repomind/` Python utility is untouched.

## Notes

This is a real-time procedural character, not photogrammetry or an exact likeness of a performer. The supplied images are used as design references and are displayed in the app’s reference rail. All runtime textures are generated locally with Canvas 2D; there are no external runtime asset hosts or CDN dependencies.
