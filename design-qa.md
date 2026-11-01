# Design QA

Current status: rear mountain cloud coverage, real-canopy leaf origins and local cloud illumination with branched lightning verified through native Chrome CUA. Both language controls and optional thunder were exercised. Latest evidence is in Iteration 7; earlier screenshots below are historical. Quantitative GPU profiling has not been performed.

- Source visual truth: `docs/visual-target.png`
- Implementation screenshot: `docs/qa/desktop-final.jpg`
- Weather cloud/precipitation comparison: `docs/qa/weather-cloud-precipitation-comparison-v2.jpg`
- Final restored local-time preview: `docs/qa/weather-visual-final.jpg`
- Local-time night screenshot: `docs/qa/local-time-final.jpg`
- English snow/snowman screenshot: `docs/qa/snow-english-final.jpg`
- Final local-time handoff screenshot: `docs/qa/handoff-final.jpg`
- Full-view comparison: `docs/qa/source-implementation-comparison.jpg`
- Focused comparisons: `docs/qa/ui-comparison.jpg`, `docs/qa/gauges-comparison.jpg`, `docs/qa/forecast-comparison.jpg`
- Viewport: 1672 × 941 CSS px, device pixel ratio 1
- Source/implementation dimensions: both 1672 × 941; no density normalization required
- State: Chinese web UI, sunny demo weather, clear accumulated snow, debug environment set to summer/day/hour 12 for like-for-like comparison with the day mock. The visible clock intentionally continued to show the user's real local time and season.
- Browser-rendered implementation: `http://localhost:4173/`

## Evidence

- Full view: overall miniature-island composition, cottage/meadow/hill/pond placement, left weather card, right four-gauge panel, bottom forecast, and orbit hint were compared side by side.
- Focused UI: card hierarchy, bilingual control, local clock, large temperature, condition, feels-like line, divider, and copy were checked.
- Focused instruments: four labels, values, units, tracks, ticks, colored fills, and circular markers were checked.
- Focused forecast: three-column structure, icons, selected underline, separators, and orbit hint were checked.

## Findings

### Iteration 1

- [P2] The debug day scene initially retained the real-time night UI theme, making the card unnecessarily pale in the source/implementation comparison.
  - Fix: theme state now follows the effective environment phase. Real user time still drives the default theme; query/debug overrides only affect the scene/environment used for QA.
  - Post-fix evidence: `docs/qa/desktop-final.jpg` shows the expected day card contrast and theme.

No actionable P0/P1/P2 findings remain.

### Iteration 2

- [P1] The first cloud implementation reused one sculptural mesh at three scales, so sunny, overcast, and rain did not have distinct cloud anatomy or coverage. Rain and snow also filled a sky-wide volume instead of beginning at cloud bases, and autumn leaves filled the whole frame.
  - Fix: replaced the runtime cloud mesh with three RGBA cloud sprites—fair-weather cumulus, broad stratus, and a low rain cloud. Sunny/clear-night now shows no clouds; overcast shows five stratus layers; rain shows four rain clouds; storms show five; snow shows four softer stratus layers. Rain and snow particles start at each active cloud base and end at terrain height. Autumn leaves now originate at seven tree-crown zones, land nearby, leave a small ground scatter, and pause during rain/snow.
  - Post-fix evidence: `docs/qa/weather-cloud-precipitation-comparison.jpg`; runtime checks recorded `cloudsVisible` 0/5/4/4 and `precipitationClouds` 0/0/4/4 for sunny/cloudy/rain/snow.

### Iteration 3

- [P1] The RGBA photo-texture clouds still looked like separate photographic layers, especially the five-piece overcast arrangement. They did not share the painted, physical miniature language of the Tripo terrain, cottage, and animals.
  - Fix: removed the sprite-texture pipeline and replaced it with four local Blender entity meshes—cumulus, companion cumulus, irregular stratus, and low rain cloud. Each GLB carries vertex-color shading for bright tops and blue-gray undersides. Overcast now combines three broken stratus layers and one small companion cloud at varied heights, rotations, and opacities; rain keeps four rain clouds, storms five, and snow three. Rain and snow particles remain anchored to cloud bases and are constrained to terrain bounds. Autumn falling leaves were reduced and kept in tree-crown zones.
  - Post-fix evidence: `docs/qa/weather-cloud-precipitation-comparison-v2.jpg`; runtime checks recorded `cloudsVisible` 0/4/4/5/3 and `precipitationClouds` 0/0/4/5/3 for sunny/cloudy/rain/storm/snow. Snow reached `snow=0.940`, `snowfall=true`, and `snowman=true`.

### Residual differences

- [P3] The rendered Tripo models are softer and less micro-detailed than the painted concept. This is expected from image-to-3D reconstruction and is offset by matching subject structure, real 360-degree geometry, editable Blender sources, and animated animals/fish.
- [P3] The implementation adds a local clock, language toggle, lampposts, seasonal effects, and snowman that were not in the original static mock. These are intentional additions requested after the mock was selected.

## Interaction and state checks

- Chinese/English toggle updates document language, title, card, gauges, forecast, controls, weather menu, city names, and search labels.
- Local clock advances with the user's browser and displays local season/daylight phase.
- Autumn night: yellowed vegetation, falling leaves, cottage window light, lampposts, reduced animals, and moving fish verified.
- Snow: full upward-surface coverage, snowfall, snowman, reduced animals, and snow note verified.
- Day-after snow: selecting the sunny next day stops snowfall but retains accumulated snow and the snowman while showing slow melting.
- Mouse drag and arrow keys orbit around the Y axis; polar angle stays fixed. Reset and auto-orbit controls work.
- Browser console errors: none.
- Re-verified the default URL after fixing the optional `hour` query parameter: the card and scene both used the browser's real local hour (approximately 02:57, autumn night), rather than falling back to midnight.
- After the entity-cloud iteration, the default URL again used the browser's real local hour (approximately 04:07, autumn night). Test snow was cleared; `snow=0.000`, `cloudsVisible=0`, leaves remained on, and the console had no errors.
- English long weather copy wraps within the card. Snow preview showed coverage, falling snow, and the snowman; switching to the following sunny day stopped snowfall while retaining the snowman and approximately 5 cm of melting snow.

## Verification

- `npm test`: 9 tests passed.
- `npm run build`: passed and emitted `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`.
- `npm run test:sites`: 4 tests passed.
- Historical regression after the local-hour fix: `npm test` 8 passed, `npm run build` passed, `npm run test:sites` 4 passed.
- Blender source audit: all 7 `.blend` files opened without missing textures; all 7 animation clips produced mesh deformation and matching first/last frames. See `docs/qa/blender-assets.json`.
- Delivery audit: `docs/completion-audit.md` maps the complete objective to current files, runtime behavior, and validation evidence.
- Clear weather at the viewer's local night now uses the moon icon and the bilingual clear-night label/message.
- Current cloud/precipitation regression: 9 app tests passed, including embedded GLB, vertex-color shading, and distinct cloud aspect checks; production build and 4 Sites tests re-run below.

final result: current cloudy lighting and cloud appearance visually verified; quantitative performance profiling not performed

### Iteration 4 — Natural volume clouds

- User rejected the solid clouds as unnatural. Their smooth silhouettes and broad surfaces read like clay/sausages, and the framing cropped the sky.
- Replaced all runtime cloud GLBs with three R8 3D density textures. Ray marching integrates opacity with a four-sample sun shadow and a softer blue-gray underside. The density includes domain warping, several scales of erosion and an irregular connected core. Each volume stays three-dimensional during orbit.
- Reduced and rearranged the clouds; increased vertical camera framing from 12.3 to 14.5 and raised the target to 2.25 while preserving the orbit inclination, leaving room above the hill.
- Particle emitters are baked from the lowest non-empty density voxels under dense columns and transformed with cloud rotation/scale. Rain and snow start at actual cloud bases.
- Automated density tests verify complete data, empty boundary voxels (no visible box), a feathered translucent region, coherent core and different anatomy per weather.
- Pending: browser shader compilation, live appearance, frame rate and full weather/orbit regression. CUA was retried and reset but continued to return “Local browser use is disabled in Work settings”. Do not represent old screenshots or the isolated Blender asset render as a verified current webpage.

### Iteration 5 — Lighting matched to overcast clouds

- Current-run evidence: `docs/qa/01-cloudy-lighting-before.png`, `02-sunny-lighting-baseline.png`, `03-cloudy-lighting-after.png`; side-by-side comparison `docs/qa/cloudy-lighting-comparison.jpg`. Captures share the 1920×962 native Chrome window, 1920×841 web content, the day/hour-12 override and the initial viewing angle.
- Finding: original cloudy ground brightness was almost the same as sunny weather, with visible direct-light shadows. The clouds looked like uniformly soft white patches.
- Fix: reduced cloudy direct sun from 1.2 to 0.22 and shadow intensity to 0.18; used neutral diffuse fill, a gray-blue sky and exposure 0.77. Rebuilt cloud density with more distinct upper billows and a narrower soft perimeter; increased light-path shadow sampling and darkened cloud-base shading.
- Orbit finding/fix: clouds overlapped the cottage roof from the back. Moved the stratus volumes higher and closer to the island center in XZ while preserving their frontal sky composition. `docs/qa/04-cloudy-orbit.png` shows the rear roof clear of cloud overlap.
- Regression evidence: `docs/qa/05-cloudy-regression-rain.png` and `06-cloudy-regression-snow.png` show active precipitation starting below visible clouds. Test snow was cleared and the page restored to cloudy/day/hour 12.
- `npm test`: 9 passed; `npm run build`: passed; `npm run test:sites`: 4 passed. The density test now measures the translucent fraction relative to occupied voxels, so reducing a cloud's total volume does not falsely fail the soft-edge requirement.
- Limits: this pass assesses the visible scene and orbit; no full accessibility audit, console-log audit or numerical FPS benchmark is claimed.

### Iteration 6 — Rain-cloud layout and intensity grades

- User feedback: rain-cloud orientation/position looked odd, and light/moderate/heavy rain need distinct cloud thickness and weather presentation. Baseline captured this run: `docs/qa/rain-old-position.png` (pitched, cropped rear cloud and overly dense light rain).
- Added `moderateRain` and `heavyRain` while preserving `rain` as light rain. All three use different volumetric density assets. `storm` remains independent and is the only rain state that flashes lightning.
- Cloud layouts now occupy a level XZ cloud layer above the island, with uniform long-axis orientation, two banks for light rain, three for moderate, four for heavy/storm. Rain framing smoothly pulls back from a 14.5 to 18.3 vertical span and shifts the view upward by 1.25, preserving Y-axis orbit inclination and user zoom. This creates headroom and removes the prior sideways cloud column over the cottage.
- Grades increase cloud height, opacity/absorption, coverage, streak count/length/speed, wetness and pond ripples, while reducing daylight. Rain particles are 380/1050/2200 for light/moderate/heavy (2600 in storms); these are visual presets, not meteorological rainfall thresholds.
- Density-derived emission points follow the active grade texture and cloud transforms. Cloud arrivals settle over the island before precipitation begins.
- Current-run native Chrome evidence: `rain-grade-light.png`, `rain-grade-moderate.png`, `rain-grade-heavy.png`, plus `rain-grade-heavy-side.png`, `rain-grade-heavy-back.png`, `rain-menu-en.png`, and `rain-menu-zh.png`. Both language menus expose all 10 weather states, and grade switching updates the card and scene.
- Automated checks: 11 app tests, production build, and 4 Sites tests passed. Tests cover grade progression, provider boundary, bilingual labels, all volume assets and cloud-base precipitation origins. Quantitative GPU frame rate has not been benchmarked.

### Iteration 7 — World-space clouds, actual tree crowns and thunderstorms

- User finding: the frontal cloud arrangement left the rear summit empty; leaf emitters did not follow the retained trees closely enough; lightning was too easy to miss.
- Clouds now use separate rear-mountain, meadow and lateral banks in world coordinates. The rear bank is wider so its actual density, not only its bounding box, covers the three summit trees. Light rain's two banks already include the rear mountain. Clouded-weather framing leaves headroom without changing orbit elevation. Native Chrome was dragged from front through side to rear; `docs/qa/clouds-rear-final.png` shows the latest rear coverage.
- Replaced guessed tree zones and point sprites with a small folded leaf GLB. `scripts/prepare-tree-effects.py` raycasts the retained terrain and uses its albedo/height separation to identify six canopy components, exporting 24 surface emitters per tree plus bare-ground heights. Small rim shrubs/stones are excluded. Thirty staggered leaf instances include flight, ground rest and invisible waiting; there is no sky-wide spawn volume. Static litter stays near the same trees. `leaf-canopy-motion-comparison.jpg` records actual browser frames around the tree crowns.
- Rebuilt lightning as a full 3D white core, blue halo and two irregular branches, anchored to the selected density-derived cloud base. A local volume-light falloff lights the discharge region inside the cloud rather than turning entire clouds white. Short clustered pulses are separated by several seconds of darkness; the emitting bank varies. `lightning-local-contact.jpg` records the actual page across a flash sequence.
- Thunder is locally synthesized, delayed after a flash, and silent by default. Both `Thunder off/on` and `雷声：关/开` were exercised, as was the repeatable `Preview lightning / 闪电演示` button. Chrome reported audio playback when enabled; it was turned off afterward. No new Tripo task or external recording was used.
- Added meaningful regression coverage for source-model SHA, crown/ground separation, leaf flight and landing continuity, real cloud-density coverage at rear-summit points across rain grades and drift, cloud preglow/pulse intervals, and complete unclipped thunder audio. Sixteen app tests pass. Production and Sites results are recorded after the final run.
- Final verification: `npm test` 16 passed; `npm run build` passed; `npm run test:sites` 4 passed. Required Sites build files are present. Current cloudy page console has only React's development-tools notice and no errors. Native Chrome was restored to the normal front view, English preference, sound off, auto orbit off. The daylight override is retained for reviewing these effects. `docs/qa/spatial-weather-proof.jpg` combines actual browser crops of the three requested fixes.

### Iteration 8 — Rain visibly begins beneath the clouds

- User finding: rain still appeared on cloud faces instead of emerging below them. The baseline `docs/qa/rain-origin-before.png` confirms bright streaks across the rear and front cloud layers.
- Cause: transparent cloud volumes do not write an opaque depth surface; the rain's later render order painted rear precipitation over nearer clouds. Cloud volumes now composite after rain/snow while keeping lightning above them. This hides precipitation through dense cloud bodies and retains soft transmission at wispy edges.
- Rain starts 0.06 world units below the density-derived base, without its old random lateral offset. Wind displacement begins at zero there and grows with fall distance; both streak endpoints now follow that same slope.
- Actual native Chrome front and rear views confirm heavy rain is below the visible underside (`rain-origin-heavy-after.png`, `rain-origin-heavy-rear.png`). The matched front-view comparison is `rain-origin-comparison.jpg`.
- Also switched through light rain, moderate rain and thunderstorm in the actual page; `rain-origin-light-after.png`, `rain-origin-moderate-after.png` and `rain-origin-storm-after.png` show each grade emerging beneath its own cloud layer. The preview is left at thunderstorm/day/hour 12, normal front view, sound off and auto orbit off.
- Regression: 16 application tests passed; production build passed; 4 Sites tests passed. Existing cloud density, real cloud-base anchors, rain grading and lightning tests remain intact.

### Iteration 9 — Consistent weather framing

- User finding: clear and night scenes used a 14.5-unit orthographic height while cloudy, rain, storm and snow expanded to 18.3 units, so switching weather changed apparent scale and composition.
- Fix: moved the camera rule into `src/camera.js` and removed the weather-driven 18.3-unit expansion and 1.25-unit target rise. Every weather state now uses the same desktop 14.5-unit orthographic height; narrow viewports retain the existing `21 / aspect` responsive rule. Orbit inclination, manual zoom, auto-orbit and reset restore the same base framing.
- Cloud layouts and precipitation must fit the shared frame rather than changing the camera. Current-run evidence is `docs/qa/consistent-camera-comparison.jpg`, which compares sunny, cloudy, heavy rain, storm and snow at the same viewport and camera orientation.
- Regression: 17 application tests passed, production build passed, and 4 Sites tests passed. Required Sites outputs remain present.
