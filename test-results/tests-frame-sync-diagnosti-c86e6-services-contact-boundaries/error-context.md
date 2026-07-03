# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\frame-sync-diagnostics.spec.js >> diagnose home services contact boundaries
- Location: tests\frame-sync-diagnostics.spec.js:277:1

# Error details

```
Error: browserType.launch: Executable doesn't exist at C:\Users\sathi\AppData\Local\ms-playwright\chromium_headless_shell-1223\chrome-headless-shell-win64\chrome-headless-shell.exe
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```

# Test source

```ts
  132 | 
  133 |     const readVideo = id => {
  134 |       const el = document.getElementById(id);
  135 |       if (!el) return null;
  136 |       const style = readStyle(el);
  137 |       return {
  138 |         id,
  139 |         src: el.currentSrc || el.src || '',
  140 |         currentTime: round(el.currentTime || 0),
  141 |         duration: round(el.duration || 0),
  142 |         readyState: el.readyState,
  143 |         networkState: el.networkState,
  144 |         paused: el.paused,
  145 |         ended: el.ended,
  146 |         playbackRate: el.playbackRate,
  147 |         opacity: style.opacity,
  148 |         transform: style.transform,
  149 |         filter: style.filter,
  150 |         visibility: style.visibility
  151 |       };
  152 |     };
  153 | 
  154 |     const readSection = id => {
  155 |       const el = document.getElementById(id);
  156 |       if (!el) return null;
  157 |       const style = readStyle(el);
  158 |       return {
  159 |         id,
  160 |         active: el.classList.contains('active'),
  161 |         opacity: style.opacity,
  162 |         visibility: style.visibility,
  163 |         transform: style.transform,
  164 |         pointerEvents: style.pointerEvents
  165 |       };
  166 |     };
  167 | 
  168 |     const snapshot = kind => ({
  169 |       kind,
  170 |       t: round(performance.now()),
  171 |       bodyClass: document.body.className,
  172 |       bg: readVideo('bg-video'),
  173 |       buffer: readVideo('handoff-video-buffer'),
  174 |       servicesIntro: readVideo('services-bg-video'),
  175 |       servicesLoop: readVideo('services-loop-video'),
  176 |       sections: {
  177 |         services: readSection('services-section'),
  178 |         contact: readSection('contact-section'),
  179 |         about: readSection('about-section'),
  180 |         portfolio: readSection('portfolios-section')
  181 |       },
  182 |       staticLogoOverlayExists: Boolean(document.getElementById('stabilized-logo'))
  183 |     });
  184 | 
  185 |     window.__markFrameSync = label => {
  186 |       window.__frameSyncMarks.push({ label, t: round(performance.now()) });
  187 |       window.__frameSyncEvents.push({ label, ...snapshot('mark') });
  188 |     };
  189 | 
  190 |     window.__getFrameSyncDiagnostics = () => ({
  191 |       marks: window.__frameSyncMarks,
  192 |       events: window.__frameSyncEvents
  193 |     });
  194 | 
  195 |     window.addEventListener('DOMContentLoaded', () => {
  196 |       const ids = ['bg-video', 'handoff-video-buffer', 'services-bg-video', 'services-loop-video'];
  197 |       const watchedEvents = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'playing', 'waiting', 'pause', 'ended', 'seeking', 'seeked'];
  198 | 
  199 |       const attach = id => {
  200 |         const el = document.getElementById(id);
  201 |         if (!el || el.dataset.frameSyncWatched === 'true') return;
  202 |         el.dataset.frameSyncWatched = 'true';
  203 |         watchedEvents.forEach(type => {
  204 |           el.addEventListener(type, () => {
  205 |             window.__frameSyncEvents.push({
  206 |               videoEvent: type,
  207 |               videoId: id,
  208 |               ...snapshot('video-event')
  209 |             });
  210 |           });
  211 |         });
  212 |       };
  213 | 
  214 |       ids.forEach(attach);
  215 |       const observer = new MutationObserver(() => ids.forEach(attach));
  216 |       observer.observe(document.documentElement, { childList: true, subtree: true });
  217 |       let frame = 0;
  218 |       const sample = () => {
  219 |         frame += 1;
  220 |         if (frame % 2 === 0) {
  221 |           window.__frameSyncEvents.push({ frame, ...snapshot('raf') });
  222 |         }
  223 |         requestAnimationFrame(sample);
  224 |       };
  225 |       requestAnimationFrame(sample);
  226 |     });
  227 |   });
  228 | }
  229 | 
  230 | async function setupPage() {
  231 |   const app = await startStaticServer(process.cwd());
> 232 |   const browser = await chromium.launch({ headless: true });
      |                                  ^ Error: browserType.launch: Executable doesn't exist at C:\Users\sathi\AppData\Local\ms-playwright\chromium_headless_shell-1223\chrome-headless-shell-win64\chrome-headless-shell.exe
  233 |   const context = await browser.newContext({
  234 |     viewport: { width: 1440, height: 900 },
  235 |     recordVideo: {
  236 |       dir: 'videos-frame-sync-diagnostics/',
  237 |       size: { width: 1440, height: 900 }
  238 |     }
  239 |   });
  240 |   const page = await context.newPage();
  241 |   await installLocalRoutes(page);
  242 |   await installDiagnostics(page);
  243 |   return { app, browser, context, page };
  244 | }
  245 | 
  246 | async function teardown(env) {
  247 |   await env.context.close();
  248 |   await env.browser.close();
  249 |   env.app.server.close();
  250 | }
  251 | 
  252 | async function boot(page, url) {
  253 |   await page.goto(url, { waitUntil: 'domcontentloaded' });
  254 |   await page.waitForTimeout(6200);
  255 |   await page.evaluate(() => window.__markFrameSync('home-settled'));
  256 | }
  257 | 
  258 | async function dump(page, name) {
  259 |   const outDir = path.join(process.cwd(), 'output', 'frame-sync-diagnostics');
  260 |   fs.mkdirSync(outDir, { recursive: true });
  261 |   const diagnostics = await page.evaluate(() => window.__getFrameSyncDiagnostics());
  262 |   const serialized = JSON.stringify(diagnostics);
  263 |   const forbiddenRuntimeMedia = [
  264 |     'PORTFOLIO%20ANIMATION',
  265 |     'BLOG%20%20ANIMATION',
  266 |     'Screen%20Recording',
  267 |     'cinematic-reference',
  268 |     'ai-context/references'
  269 |   ];
  270 |   const leakedAsset = forbiddenRuntimeMedia.find(asset => serialized.includes(asset));
  271 |   if (leakedAsset) {
  272 |     throw new Error(`Forbidden reference/runtime media appeared in transition diagnostics: ${leakedAsset}`);
  273 |   }
  274 |   fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(diagnostics, null, 2));
  275 | }
  276 | 
  277 | test('diagnose home services contact boundaries', async () => {
  278 |   const env = await setupPage();
  279 |   try {
  280 |     await boot(env.page, env.app.url);
  281 |     await env.page.evaluate(() => window.__markFrameSync('click-services'));
  282 |     await env.page.click('.nav-item[data-target="services-section"]');
  283 |     await env.page.waitForTimeout(4700);
  284 |     await env.page.evaluate(() => window.__markFrameSync('services-ambient'));
  285 |     await env.page.evaluate(() => {
  286 |       window.__markFrameSync('click-contact');
  287 |       document.querySelector('#services-section .nav-link[data-target="contact-section"]')?.click();
  288 |     });
  289 |     await env.page.waitForTimeout(4700);
  290 |     await env.page.evaluate(() => window.__markFrameSync('contact-active'));
  291 |     await dump(env.page, 'home-services-contact');
  292 |   } finally {
  293 |     await teardown(env);
  294 |   }
  295 | });
  296 | 
  297 | test('diagnose direct home about and about portfolio boundaries', async () => {
  298 |   const env = await setupPage();
  299 |   try {
  300 |     await boot(env.page, env.app.url);
  301 |     await env.page.evaluate(() => window.__markFrameSync('click-about'));
  302 |     await env.page.click('.nav-item[data-target="about-section"]');
  303 |     await env.page.waitForTimeout(4300);
  304 |     await env.page.evaluate(() => window.__markFrameSync('about-active'));
  305 |     await env.page.evaluate(() => {
  306 |       window.__markFrameSync('click-portfolio');
  307 |       document.querySelector('#about-section .nav-link[data-target="portfolios-section"]')?.click();
  308 |     });
  309 |     await env.page.waitForTimeout(6500);
  310 |     await env.page.evaluate(() => window.__markFrameSync('portfolio-active'));
  311 |     await dump(env.page, 'home-about-portfolio');
  312 |   } finally {
  313 |     await teardown(env);
  314 |   }
  315 | });
  316 | 
  317 | test('diagnose contact about portfolio chained boundaries', async () => {
  318 |   const env = await setupPage();
  319 |   try {
  320 |     await boot(env.page, env.app.url);
  321 |     await env.page.evaluate(() => window.__markFrameSync('click-contact'));
  322 |     await env.page.click('.nav-item[data-target="contact-section"]');
  323 |     await env.page.waitForTimeout(4300);
  324 |     await env.page.evaluate(() => window.__markFrameSync('contact-active'));
  325 |     await env.page.evaluate(() => {
  326 |       window.__markFrameSync('click-about');
  327 |       document.querySelector('#contact-section .nav-link[data-target="about-section"]')?.click();
  328 |     });
  329 |     await env.page.waitForTimeout(5200);
  330 |     await env.page.evaluate(() => window.__markFrameSync('about-active'));
  331 |     await env.page.evaluate(() => {
  332 |       window.__markFrameSync('click-portfolio');
```