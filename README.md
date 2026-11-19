# Guitar Tuner — MVP 0.2 — Headstock Tuner UI

A mobile-first, browser-based chromatic tuner for a 6-string guitar. It uses the device microphone and processes audio locally in the browser.

## Included in this MVP

- Real-time pitch detection using a YIN-style algorithm
- E Standard, Eb Standard, D Standard, Drop D, Drop C, C Standard, DADGAD, Open D and Open G presets
- Custom tuning editor for all six strings
- Auto string detection and Manual string selection
- Frequency (Hz), pitch deviation (cents), and a grid-style tuning meter
- Headstock-inspired string selector with six individually selectable string buttons
- A4 reference pitch setting (432 / 440 / 442 Hz)
- PWA manifest and basic offline app-shell caching

## Run locally

1. Open this folder in VS Code.
2. Start a local server from the project root. VS Code Live Server is fine.
3. Open the local URL in Chrome or Edge.
4. Press **Start tuning** and allow microphone access.

Microphone access requires a secure context. `localhost` is supported for local development. When testing on an iPhone, deploy to an HTTPS URL first, then open the URL in Safari and allow microphone access.

## Deploy with GitHub Pages

1. Create a new GitHub repository, for example `guitar-tuner`.
2. Push the contents of this folder to the repository's `main` branch.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then save.
6. Open the published HTTPS URL on your iPhone in Safari.
7. Use **Share → Add to Home Screen** to install the web app.

## Important notes

- This MVP has no backend and does not upload or store microphone audio.
- Tune one string at a time in a quiet environment for the best result.
- The tuner currently estimates the fundamental frequency in the guitar range. Very noisy rooms, strong harmonics, low-quality microphones, or multiple strings ringing together can reduce accuracy.
- Custom tuning changes are held in memory for the current session. Persistent saved presets can be added in a later iteration.
- This is a first working prototype. Validate tuning accuracy against a trusted tuner before relying on it for critical tuning.

## Suggested next improvements

1. Test and refine pitch detection on real guitar audio, especially low C2 and E2.
2. Save custom tunings in local storage.
3. Add string-specific lock and noise-gate controls.
4. Add chord finder as a separate feature after the tuner is stable.
