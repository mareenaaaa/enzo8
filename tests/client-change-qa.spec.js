const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = '/home/rahul/projects/enzo8';
const outDir = path.join(root, 'output', 'client-change-qa');
const videoDir = path.join(root, 'videos-client-change-qa');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

const gsapPath = require.resolve('gsap/dist/gsap.min.js', { paths: [root] });

async function installRoutes(page) {
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js', route =>
    route.fulfill({ path: gsapPath, contentType: 'application/javascript' })
  );
  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: 'window.LocomotiveScroll=class{constructor(){this.el=null}update(){}stop(){}start(){}scrollTo(){}};' })
  );
  await page.route('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: 'window.emailjs={init(){},send(){return Promise.resolve({status:200})}};' })
  );
  await page.route('https://cdn.jsdelivr.net/npm/@mux/mux-player', route =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        customElements.define('mux-player', class extends HTMLElement {
          constructor(){ super(); this._paused=true; this._currentTime=0; this._muted=this.hasAttribute('muted'); this._loop=this.hasAttribute('loop'); this._volume=1; }
          connectedCallback(){ this.style.background='linear-gradient(135deg,#05070d,#111a30 48%,#05070d)'; this.style.display='block'; }
          play(){ this._paused=false; this.dispatchEvent(new Event('play')); return Promise.resolve(); }
          pause(){ this._paused=true; this.dispatchEvent(new Event('pause')); }
          get paused(){ return this._paused; }
          get currentTime(){ return this._currentTime; }
          set currentTime(v){ this._currentTime=Number(v)||0; }
          get duration(){ return 12; }
          get muted(){ return this._muted || this.hasAttribute('muted'); }
          set muted(v){ this._muted=Boolean(v); if(v)this.setAttribute('muted',''); else this.removeAttribute('muted'); }
          get loop(){ return this._loop || this.hasAttribute('loop'); }
          set loop(v){ this._loop=Boolean(v); if(v)this.setAttribute('loop',''); else this.removeAttribute('loop'); }
          get volume(){ return this._volume; }
          set volume(v){ this._volume=Number(v); }
        });
      `
    })
  );
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://fonts.gstatic.com/**', route => route.fulfill({ body: '' }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css', route => route.fulfill({ contentType: 'text/css', body: '' }));
}

async function shot(page, summary, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  summary.screenshots.push(file);
}

async function routeTo(page, target) {
  const start = await page.evaluate(() => performance.now());
  await page.click(`.nav-item[data-target="${target}-section"]`);
  await page.waitForFunction(id => {
    const section = document.getElementById(`${id}-section`);
    return section && section.classList.contains('active') && getComputedStyle(section).visibility !== 'hidden';
  }, target, { timeout: 45000 });
  return Math.round(await page.evaluate(startTime => performance.now() - startTime, start));
}

test('client change request QA', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();
  await installRoutes(page);

  const summary = { url: process.env.QA_BASE_URL || 'http://127.0.0.1:4173', timingsMs: {}, checks: {}, screenshots: [] };
  await page.goto(summary.url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.classList.contains('hero-nav-ready'), null, { timeout: 45000 });
  await page.waitForTimeout(250);
  await shot(page, summary, '01-home');
  summary.checks.homeWordmark = await page.evaluate(() => {
    const el = document.getElementById('home-wordmark');
    return { text: el?.textContent?.trim(), opacity: Number(getComputedStyle(el).opacity) };
  });

  await page.hover('.nav-item[data-target="services-section"]');
  await page.waitForTimeout(350);
  await shot(page, summary, '02-home-nav-hover');
  summary.checks.navHover = await page.evaluate(() => {
    const el = document.querySelector('.nav-item[data-target="services-section"]');
    const style = getComputedStyle(el);
    const after = getComputedStyle(el, '::after');
    return { background: style.backgroundColor, transform: style.transform, underlineOpacity: Number(after.opacity) };
  });

  summary.timingsMs.homeToAbout = await routeTo(page, 'about');
  await page.waitForTimeout(500);
  await shot(page, summary, '03-about');
  await page.click('#meet-team-btn');
  await page.waitForTimeout(900);
  await shot(page, summary, '04-about-team');
  summary.checks.aboutTeam = await page.evaluate(() => {
    const members = [...document.querySelectorAll('#about-team-inline .member')];
    const amal = document.querySelector('#about-team-inline .member[data-member="amal"]');
    const rect = amal?.getBoundingClientRect();
    return { memberCount: members.length, amalVisible: Boolean(rect && rect.width && rect.height), amalTop: rect ? Math.round(rect.top) : null };
  });
  await page.evaluate(() => {
    window.__aboutTeamReturnQa = {
      startScrollTop: document.getElementById('about-section')?.scrollTop || 0,
      frames: []
    };
    const tick = () => {
      const about = document.getElementById('about-section');
      const services = document.getElementById('services-section');
      if (!window.__aboutTeamReturnQa || !about) return;
      const servicesActive = Boolean(services?.classList.contains('active'));
      window.__aboutTeamReturnQa.frames.push({
        t: performance.now(),
        scrollTop: Math.round(about.scrollTop),
        servicesActive
      });
      if (!servicesActive || about.scrollTop > 2) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const aboutToServicesStart = await page.evaluate(() => { const t = performance.now(); document.querySelector('#about-section .nav-link[data-target="services-section"]').click(); return t; });
  await page.waitForFunction(() => document.getElementById('services-section')?.classList.contains('active'), null, { timeout: 45000 });
  summary.timingsMs.aboutToServices = Math.round(await page.evaluate(t => performance.now() - t, aboutToServicesStart));
  summary.checks.aboutTeamReturn = await page.evaluate(() => {
    const qa = window.__aboutTeamReturnQa || { startScrollTop: null, frames: [] };
    const firstServicesFrame = qa.frames.find(frame => frame.servicesActive) || null;
    const zeroBeforeServices = qa.frames.some(frame => frame.scrollTop <= 2 && !frame.servicesActive);
    return {
      startScrollTop: qa.startScrollTop,
      frameCount: qa.frames.length,
      zeroBeforeServices,
      firstServicesScrollTop: firstServicesFrame ? firstServicesFrame.scrollTop : null
    };
  });
  if (!summary.checks.aboutTeamReturn.zeroBeforeServices || summary.checks.aboutTeamReturn.firstServicesScrollTop !== 0) {
    throw new Error(`About Team did not return to top before Services transition: ${JSON.stringify(summary.checks.aboutTeamReturn)}`);
  }
  await page.waitForTimeout(900);
  await shot(page, summary, '05-services');

  const servicesToPortfolioStart = await page.evaluate(() => { const t = performance.now(); document.querySelector('#services-section .nav-link[data-target="portfolios-section"]').click(); return t; });
  await page.waitForFunction(() => document.getElementById('portfolios-section')?.classList.contains('active'), null, { timeout: 45000 });
  summary.timingsMs.servicesToPortfolio = Math.round(await page.evaluate(t => performance.now() - t, servicesToPortfolioStart));
  await page.waitForTimeout(1000);
  await shot(page, summary, '06-portfolio');
  summary.checks.portfolioLogos = await page.evaluate(() => [...document.querySelectorAll('.client-marquee-group:first-child .client-marquee-logo')].map(img => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') })));

  await page.evaluate(() => document.querySelector('.portfolio-item')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  await page.click('.portfolio-item');
  await page.waitForFunction(() => document.body.classList.contains('portfolio-case-open'), null, { timeout: 15000 });
  await page.waitForTimeout(450);
  await shot(page, summary, '07-portfolio-selected-media');
  summary.checks.portfolioSelectedMedia = await page.evaluate(() => {
    const selected = document.querySelector('.portfolio-case-modal__player');
    const activeGrid = [...document.querySelectorAll('#portfolios-section .portfolio-video')].filter(player => !player.paused).length;
    return { exists: Boolean(selected), playbackId: selected?.getAttribute('playback-id') || null, muted: selected?.muted ?? null, paused: selected?.paused ?? null, activeGridPreviewCount: activeGrid };
  });
  await page.click('.portfolio-case-modal__close');
  await page.waitForTimeout(350);
  summary.checks.portfolioMediaReset = await page.evaluate(() => ({
    modalOpen: document.body.classList.contains('portfolio-case-open'),
    selectedPlayerExists: Boolean(document.querySelector('.portfolio-case-modal__player')),
    selectedItems: document.querySelectorAll('.portfolio-item.is-selected').length
  }));

  const portfolioToBlogStart = await page.evaluate(() => { const t = performance.now(); document.querySelector('#portfolios-section .nav-link[data-target="blogs-section"]').click(); return t; });
  await page.waitForFunction(() => document.getElementById('blogs-section')?.classList.contains('active'), null, { timeout: 45000 });
  summary.timingsMs.portfolioToBlog = Math.round(await page.evaluate(t => performance.now() - t, portfolioToBlogStart));
  await page.waitForTimeout(700);
  await shot(page, summary, '08-blog');
  summary.checks.blogLayout = await page.evaluate(() => {
    const grid = document.querySelector('.blog-grid');
    return { cardCount: document.querySelectorAll('.blog-card').length, columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length };
  });

  const blogToContactStart = await page.evaluate(() => { const t = performance.now(); document.querySelector('#blogs-section .nav-link[data-target="contact-section"]').click(); return t; });
  await page.waitForFunction(() => document.getElementById('contact-section')?.classList.contains('active'), null, { timeout: 45000 });
  summary.timingsMs.blogToContact = Math.round(await page.evaluate(t => performance.now() - t, blogToContactStart));
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => {
    const video = document.getElementById('bg-video');
    const glow = document.querySelector('.contact-plum-glow');
    return { videoTransform: getComputedStyle(video).transform, videoFilter: getComputedStyle(video).filter, glowOpacity: getComputedStyle(glow).opacity };
  });
  await page.mouse.move(1200, 210);
  await page.waitForTimeout(1450);
  const after = await page.evaluate(() => {
    const video = document.getElementById('bg-video');
    const glow = document.querySelector('.contact-plum-glow');
    return { videoTransform: getComputedStyle(video).transform, videoFilter: getComputedStyle(video).filter, glowOpacity: getComputedStyle(glow).opacity };
  });
  await shot(page, summary, '09-contact-handshake-response');
  summary.checks.contactHandshake = { before, after };

  fs.writeFileSync(path.join(outDir, 'qa-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await context.close();
});
