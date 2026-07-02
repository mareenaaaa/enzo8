# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/section-routing.spec.js >> all directed section pairs preserve transition ownership on mobile
- Location: tests/section-routing.spec.js:439:1

# Error details

```
TimeoutError: page.waitForFunction: Timeout 18000ms exceeded.
```

# Test source

```ts
  252 |     expect(states.contact.staticLogoOverlayExists).toBe(false);
  253 |   });
  254 | });
  255 | 
  256 | test('contact about routes through home logo state', async () => {
  257 |   await runFlow('contact-about', async (page, states, qaDir) => {
  258 |     await clickMainNav(page, 'contact-section');
  259 |     await waitForActiveSection(page, 'contact-section');
  260 |     await page.waitForTimeout(700);
  261 |     states.contact = await captureState(page);
  262 | 
  263 |     await clickSectionNav(page, 'contact-section', 'about-section');
  264 |     await page.waitForTimeout(1100);
  265 |     states.viaHome = await captureState(page);
  266 |     await page.screenshot({ path: path.join(qaDir, '02-via-home.png'), fullPage: true });
  267 | 
  268 |     expect(states.viaHome.videoSrc).toContain('contact%20horizontal%20reverse.mp4');
  269 |     expect(states.viaHome.videoSrc).not.toContain('about%20horizontal');
  270 | 
  271 |     await waitForActiveSection(page, 'about-section');
  272 |     await page.waitForTimeout(700);
  273 |     states.about = await captureState(page);
  274 |     await page.screenshot({ path: path.join(qaDir, '03-about.png'), fullPage: true });
  275 | 
  276 |     expect(states.about.activeSections).toContain('about-section');
  277 |     expect(states.about.staticLogoOverlayExists).toBe(false);
  278 |   });
  279 | });
  280 | 
  281 | test('about portfolio routes through home logo state', async () => {
  282 |   await runFlow('about-portfolio', async (page, states, qaDir) => {
  283 |     await clickMainNav(page, 'about-section');
  284 |     await waitForActiveSection(page, 'about-section');
  285 |     await page.waitForTimeout(700);
  286 |     states.about = await captureState(page);
  287 | 
  288 |     await clickSectionNav(page, 'about-section', 'portfolios-section');
  289 |     await page.waitForTimeout(900);
  290 |     states.viaHome = await captureState(page);
  291 |     await page.screenshot({ path: path.join(qaDir, '02-via-home.png'), fullPage: true });
  292 | 
  293 |     expect(states.viaHome.videoSrc).toContain('about%20horizontal%20reverse.mp4');
  294 |     expect(states.viaHome.activeSections).not.toContain('portfolios-section');
  295 | 
  296 |     await waitForActiveSection(page, 'portfolios-section');
  297 |     await page.waitForTimeout(700);
  298 |     states.portfolio = await captureState(page);
  299 |     await page.screenshot({ path: path.join(qaDir, '03-portfolio.png'), fullPage: true });
  300 | 
  301 |     expect(states.portfolio.activeSections).toContain('portfolios-section');
  302 |     expect(states.portfolio.staticLogoOverlayExists).toBe(false);
  303 |   });
  304 | });
  305 | 
  306 | test('section reverse transitions return to home logo state', async () => {
  307 |   await runFlow('section-reverses', async (page, states, qaDir) => {
  308 |     await clickMainNav(page, 'services-section');
  309 |     await page.waitForTimeout(4800);
  310 |     await clickSectionHome(page, 'services-section');
  311 |     await waitForHome(page);
  312 |     states.afterServicesReverse = await captureState(page);
  313 | 
  314 |     await clickMainNav(page, 'contact-section');
  315 |     await waitForActiveSection(page, 'contact-section');
  316 |     await page.waitForTimeout(700);
  317 |     await clickSectionHome(page, 'contact-section');
  318 |     await waitForHome(page);
  319 |     states.afterContactReverse = await captureState(page);
  320 | 
  321 |     await clickMainNav(page, 'about-section');
  322 |     await waitForActiveSection(page, 'about-section');
  323 |     await page.waitForTimeout(700);
  324 |     await clickSectionHome(page, 'about-section');
  325 |     await waitForHome(page);
  326 |     states.afterAboutReverse = await captureState(page);
  327 |     await page.screenshot({ path: path.join(qaDir, '02-final-home.png'), fullPage: true });
  328 | 
  329 |     expect(states.afterServicesReverse.activeSections).toEqual([]);
  330 |     expect(states.afterContactReverse.activeSections).toEqual([]);
  331 |     expect(states.afterAboutReverse.activeSections).toEqual([]);
  332 |     expect(states.afterAboutReverse.staticLogoOverlayExists).toBe(false);
  333 |   });
  334 | });
  335 | 
  336 | function buildDirectedPairCircuit(nodes) {
  337 |   const adjacency = new Map(nodes.map(node => [node, nodes.filter(target => target !== node)]));
  338 |   const stack = [nodes[0]];
  339 |   const circuit = [];
  340 | 
  341 |   while (stack.length) {
  342 |     const current = stack[stack.length - 1];
  343 |     const next = adjacency.get(current).shift();
  344 |     if (next) stack.push(next);
  345 |     else circuit.push(stack.pop());
  346 |   }
  347 | 
  348 |   return circuit.reverse();
  349 | }
  350 | 
  351 | async function waitForStableSection(page, pageId, timeout = 18000) {
> 352 |   await page.waitForFunction(id => {
      |              ^ TimeoutError: page.waitForFunction: Timeout 18000ms exceeded.
  353 |     const section = document.getElementById(`${id}-section`);
  354 |     const activeSections = [...document.querySelectorAll('.scroll-section.active')];
  355 |     return section?.classList.contains('active')
  356 |       && getComputedStyle(section).visibility !== 'hidden'
  357 |       && activeSections.length === 1
  358 |       && activeSections[0] === section
  359 |       && !isAnimating;
  360 |   }, pageId, { timeout });
  361 | }
  362 | 
  363 | async function runDirectedPairMatrix(viewport) {
  364 |   const pageIds = ['about', 'services', 'portfolios', 'blogs', 'contact'];
  365 |   const circuit = buildDirectedPairCircuit(pageIds);
  366 |   const env = await setupPage({ viewport, recordVideo: false });
  367 |   env.page._appUrl = env.app.url;
  368 |   const transitionSamples = [];
  369 | 
  370 |   try {
  371 |     await bootHome(env.page);
  372 |     await env.page.evaluate(firstPageId => {
  373 |       document.querySelector(`.nav-item[data-target="${firstPageId}-section"]`)?.click();
  374 |     }, circuit[0]);
  375 |     await waitForStableSection(env.page, circuit[0]);
  376 | 
  377 |     for (let index = 1; index < circuit.length; index += 1) {
  378 |       const from = circuit[index - 1];
  379 |       const to = circuit[index];
  380 |       await env.page.evaluate(({ from, to }) => {
  381 |         window.__pairTransformSamples = [];
  382 |         window.__pairTransformTimer = setInterval(() => {
  383 |           const video = document.getElementById('bg-video');
  384 |           if (!video) return;
  385 |           window.__pairTransformSamples.push({
  386 |             src: decodeURIComponent(video.currentSrc || video.src || ''),
  387 |             scale: Number(gsap.getProperty(video, 'scale')) || 0,
  388 |             x: Number(gsap.getProperty(video, 'x')) || 0,
  389 |             y: Number(gsap.getProperty(video, 'y')) || 0
  390 |           });
  391 |         }, 40);
  392 | 
  393 |         const link = document.querySelector(`#${from}-section .nav-link[data-target="${to}-section"]`);
  394 |         if (!link) throw new Error(`Missing navigation link for ${from} -> ${to}`);
  395 |         link.click();
  396 |       }, { from, to });
  397 | 
  398 |       await waitForStableSection(env.page, to);
  399 |       const samples = await env.page.evaluate(() => {
  400 |         clearInterval(window.__pairTransformTimer);
  401 |         return window.__pairTransformSamples || [];
  402 |       });
  403 |       transitionSamples.push({ from, to, samples });
  404 | 
  405 |       const activeSections = await env.page.locator('.scroll-section.active').evaluateAll(elements => elements.map(el => el.id));
  406 |       expect(activeSections).toEqual([`${to}-section`]);
  407 |     }
  408 | 
  409 |     const traversedPairs = transitionSamples.map(({ from, to }) => `${from}->${to}`);
  410 |     expect(new Set(traversedPairs).size).toBe(pageIds.length * (pageIds.length - 1));
  411 | 
  412 |     transitionSamples.filter(item => item.from === 'contact').forEach(({ to, samples }) => {
  413 |       const reverseSamples = samples.filter(sample => sample.src.includes('contact') && sample.src.includes('reverse'));
  414 |       expect(reverseSamples.length, `Contact reverse was not visible for contact -> ${to}`).toBeGreaterThan(2);
  415 |       expect(reverseSamples.at(-1).scale, `Contact did not scale down for contact -> ${to}`)
  416 |         .toBeLessThan(reverseSamples[0].scale - 0.08);
  417 |     });
  418 | 
  419 |     transitionSamples.filter(item => item.from === 'about').forEach(({ to, samples }) => {
  420 |       const reverseSamples = samples.filter(sample => sample.src.includes('about') && sample.src.includes('reverse'));
  421 |       expect(reverseSamples.length, `About reverse was not visible for about -> ${to}`).toBeGreaterThan(2);
  422 |       const scales = reverseSamples.map(sample => sample.scale);
  423 |       const xs = reverseSamples.map(sample => sample.x);
  424 |       const ys = reverseSamples.map(sample => sample.y);
  425 |       expect(Math.max(...scales) - Math.min(...scales), `About scale moved for about -> ${to}`).toBeLessThan(0.025);
  426 |       expect(Math.max(...xs) - Math.min(...xs), `About x moved for about -> ${to}`).toBeLessThan(1);
  427 |       expect(Math.max(...ys) - Math.min(...ys), `About y moved for about -> ${to}`).toBeLessThan(1);
  428 |     });
  429 |   } finally {
  430 |     await closePage(env);
  431 |   }
  432 | }
  433 | 
  434 | test('all directed section pairs preserve transition ownership on desktop', async () => {
  435 |   test.setTimeout(240000);
  436 |   await runDirectedPairMatrix({ width: 1440, height: 900 });
  437 | });
  438 | 
  439 | test('all directed section pairs preserve transition ownership on mobile', async () => {
  440 |   test.setTimeout(240000);
  441 |   await runDirectedPairMatrix({ width: 390, height: 844 });
  442 | });
  443 | 
```