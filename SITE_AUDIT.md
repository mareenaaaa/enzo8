# Enso 8 Site Audit

Date: 2026-06-30

## Scope

Audited the static site flow across `index.html`, `main-v2.js`, `style-v2.css`, the `ai-context` markdown guidance, existing Playwright specs, and the attached browser console log. The focus was code flow, transitions, animation ownership, section sync, blog/contact overlays, and browser preflight stability.

## Architecture Summary

- `index.html` owns the fullscreen section markup: hero, about, services, portfolio, team, blogs, blog article overlay, and contact.
- `main-v2.js` owns nearly all runtime behavior: intro playback, cinematic video transitions, route state, locomotive section activation, blog article overlay, team detail overlay, portfolio Mux mounting, contact foreground mode, and mobile composition locks.
- `style-v2.css` owns the visual language, responsive overrides, active/locked section behavior, overlay layering, mobile typography, and contact/blog presentation.
- `ai-context/*.md` repeatedly warns to avoid rebuilding transition architecture. The safe path is parametric, scoped fixes only.
- Existing tests in `tests/*.spec.js` already target routing, frame sync, continuity, services, hardlock, and UI QA, but they require a Playwright browser runtime.

## Console Log Triage

- `contentscript.js:14083 MaxListenersExceededWarning` and `ObjectMultiplex` messages are from a browser extension content script, not this repo. They should be verified by testing in an incognito/profile with extensions disabled.
- Repeated `mux-player playsInline is set to true by default and is not currently supported as a setter` was site-side and came from setting `video.playsInline = true` on `mux-player` elements.
- `cast_sender.js`, `inferred.litix.io`, and Mux network failures are external network/CDN/player telemetry failures. These can create noise and delayed media behavior locally, but they are not direct JavaScript syntax failures in the app.
- Chrome reports two unsupported preload hints from `index.html` using `rel="preload" as="video"` for mobile videos. I did not change these because preload behavior is marked protected in the repo rules.

## Fix Applied

- Removed unsupported `playsInline` property assignment from dynamic Mux portfolio players in `main-v2.js`.
- Kept `playsinline` attributes on Mux elements so inline playback intent remains declared.
- Preserved native `<video>` `playsInline` setters used by the transition buffer and HTML video pipeline.

## Browser Preflight

Existing Playwright specs:

- `npx playwright test ./tests/ui.spec.js --reporter=list` initially failed in the sandbox with `spawn EPERM`.
- Running outside the sandbox reached the test runner, but failed because bundled Playwright Chromium is missing at `C:\Users\sathi\AppData\Local\ms-playwright\chromium_headless_shell-1223\...`.
- `npx playwright install chromium` was attempted, but timed out before installing the runtime.

Manual Chrome preflight:

- Used system Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe` through Playwright.
- Stubbed external GSAP/Locomotive/EmailJS/Mux routes to avoid CDN and telemetry delays during local testing.
- Mobile-sized preflight loaded the site, found 3 blog cards and 3 blog panels, opened the `automated-workflows` article, and confirmed the active article contained 8 paragraphs.
- Desktop-sized preflight confirmed DOM-triggered navigation activates `about-section`, `blogs-section`, and `contact-section` with opacity `1` and pointer events `auto`.
- Captured outputs in `test-results/manual-preflight/`.

## Verification

- `node --check main-v2.js` passed.
- `node --check tests\ui.spec.js` passed.
- `node --check tests\section-routing.spec.js` passed.
- Manual preflight produced `preflight-summary.json`, `desktop-preflight-summary.json`, and screenshots under `test-results/manual-preflight/`.

## Current Risks

- The site has a dirty working tree with many existing changes beyond this audit. I only made the Mux `playsInline` cleanup in `main-v2.js` during this pass.
- Some comments/text in `index.html` and `main-v2.js` show mojibake such as `â...` from prior encoding corruption. It is mostly comments/string punctuation, but it should be cleaned carefully in a separate encoding pass.
- The blank-screen/lag feeling is likely a combination of heavy video transition sequencing, Mux/CDN/network delays, external telemetry failures, and browser extension noise. The app route system itself did activate correctly in the manual preflight.
- The official Playwright spec suite cannot fully run until the browser runtime is installed successfully.

## Recommended Next Fixes

1. Install Playwright Chromium successfully, then run all specs: `npx playwright install chromium` followed by `npx playwright test --reporter=list`.
2. Test once in Chrome incognito with extensions disabled to confirm the `contentscript.js` warnings disappear.
3. Decide whether to keep or replace `rel="preload" as="video"` hints, because Chrome warns about them but the repo explicitly protects preload behavior.
4. Do a separate encoding cleanup for mojibake comments/text, with a careful diff so real content is not damaged.
5. If blank-screen lag persists after extension-free testing, profile transition queue state around `isAnimating`, `videoTransitionToken`, and deferred route clicks.