/**
 * Enso 8 - Cinematic Video Experience (Pure Static)
 */

let videoEl = document.getElementById('bg-video');
let state = 'scatter'; // scatter | intro | about | services | portfolios | etc
let isAnimating = false;
let isMobile = window.innerWidth <= 768;
let portfolioWarmupStarted = false; // declared early to avoid temporal dead zone

const trigger = document.getElementById('experience-trigger');
const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
const mobileHamburger = document.getElementById('mobile-hamburger');
const mobileNavClose = document.getElementById('mobile-nav-close');
const mobileBrandHome = document.getElementById('mobile-brand-home');
const mobileIntroVideo = document.getElementById('mobile-intro-video');
const transitionAudioSources = {
    about: './audio/about-us-click-transition.ogg',
    services: './audio/services-click-transition.ogg',
    portfolios: './audio/portfolio-click-transition.ogg',
    blogs: './audio/blogs-click-transition.ogg',
    contact: './audio/contact-click-transition.ogg',
    contactHome: './audio/contact-page-to-home-click-transition.ogg'
};
const transitionAudioPlayers = new Map();
let activeTransitionAudioPage = null;
const PORTFOLIO_AUDIO_REVEAL_FALLBACK_MS = 1800;

function getTransitionAudio(pageId) {
    const src = transitionAudioSources[pageId];
    if (!src) return null;

    if (!transitionAudioPlayers.has(pageId)) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = 0.82;
        transitionAudioPlayers.set(pageId, audio);
    }

    return transitionAudioPlayers.get(pageId);
}

function warmTransitionAudio(pageId) {
    const audio = getTransitionAudio(pageId);
    if (!audio) return;
    try { audio.load(); } catch (_) {}
}

function waitForTransitionAudioToFinish(pageId, transitionOwnerToken, callback, fallbackMs = PORTFOLIO_AUDIO_REVEAL_FALLBACK_MS) {
    const audio = getTransitionAudio(pageId);
    if (!audio || activeTransitionAudioPage !== pageId || audio.paused) {
        callback();
        return;
    }

    let didFinish = false;
    let fallbackTimer = null;
    const finish = () => {
        if (didFinish) return;
        didFinish = true;
        audio.removeEventListener('ended', finish);
        audio.removeEventListener('pause', finish);
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (transitionOwnerToken !== null && transitionOwnerToken !== videoTransitionToken) return;
        callback();
    };

    const remainingMs = Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.max(0, (audio.duration - audio.currentTime) * 1000 + 80)
        : fallbackMs;

    if (remainingMs <= 90) {
        finish();
        return;
    }

    audio.addEventListener('ended', finish, { once: true });
    audio.addEventListener('pause', finish, { once: true });
    fallbackTimer = setTimeout(finish, Math.min(remainingMs, fallbackMs));
}

function stopTransitionAudio(exceptPageId = null) {
    transitionAudioPlayers.forEach((audio, pageId) => {
        if (pageId === exceptPageId) return;
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (_) {}
    });
    if (activeTransitionAudioPage !== exceptPageId) {
        activeTransitionAudioPage = null;
    }
}

function playTransitionAudio(pageId) {
    const audio = getTransitionAudio(pageId);
    if (!audio) {
        stopTransitionAudio();
        return;
    }

    stopTransitionAudio(pageId);
    activeTransitionAudioPage = pageId;
    try {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0.82;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    } catch (_) {}
}

window.__transitionAudioDebug = {
    getActivePage: () => activeTransitionAudioPage,
    getState: (pageId) => {
        const audio = getTransitionAudio(pageId);
        if (!audio) return null;
        return { paused: audio.paused, currentTime: audio.currentTime, duration: audio.duration, src: audio.currentSrc || audio.src };
    }
};

/**
 * ANIMATION TUNING GUIDE
 * Edit the constants below first. Most animation size, speed, and stitch timing
 * is controlled here, then reused by the transition functions later in the file.
 *
 * Scale values:
 * - 1 means original video size.
 * - 1.3 means 30% larger.
 * - 0.64 means 36% smaller.
 *
 * Duration values:
 * - Measured in seconds.
 * - Larger duration = slower animation.
 * - Smaller duration = faster/snappier animation.
 *
 * Playback rate values:
 * - 1 means normal video speed.
 * - 2 means twice as fast.
 * - 0.5 means half speed.
 *
 * Completion lead values:
 * - Used when one video should hand off before its final frame.
 * - Larger lead = cut away earlier.
 * - Smaller lead = let the extro/intro play longer.
 *
 * Mobile contact chain:
 * - MOBILE_CONTACT_CHAIN_INTRO_START_TIME controls where the Contact intro starts
 *   after another section's extro. Keep at 0 if you want the full Contact intro.
 * - MOBILE_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD and
 *   MOBILE_SERVICES_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD control how early the
 *   previous section's extro hands off into Contact on mobile.
 * - MOBILE_SECTION_CHAIN_REVERSE_SETTLE_DURATION controls how quickly mobile
 *   extros resize into the next intro scale before the crossfade.
 * - MOBILE_SERVICES_MEDIA_SCALE should match the mobile CSS scale for the
 *   Services video elements, so Services reverse starts without a size pop.
 */
const INTRO_PLAYBACK_RATE = 2.5;
const REVERSE_PLAYBACK_RATE = 1.16;
const HOME_LOGO_DISPLAY_SCALE = 1.3;
const MOBILE_UNIFORM_CINEMATIC_SCALE = HOME_LOGO_DISPLAY_SCALE;
const ABOUT_MOBILE_CINEMATIC_SCALE = HOME_LOGO_DISPLAY_SCALE * 0.96;
const CONTACT_MOBILE_CINEMATIC_SCALE = 1;
const MOBILE_SERVICES_MEDIA_SCALE = 1.24;
const HOME_DIRECT_HANDOFF_SCALE = 1.04;
const SECTION_CHAIN_HOME_SCALE = 1;
const HOME_EQUILIBRIUM_SCALE = 0.68;
const DESKTOP_HOME_INTRO_REFERENCE_SCALE = 0.61;
const DESKTOP_HANDOFF_EQUILIBRIUM_SCALE = 0.995;
const DESKTOP_HOME_LOGO_DISPLAY_SCALE = HOME_EQUILIBRIUM_SCALE;
const HOME_EQUILIBRIUM_FRAME_LEAD = 0.06;
const INTRO_ZOOM_START_SCALE = DESKTOP_HOME_INTRO_REFERENCE_SCALE;
const INTRO_ZOOM_END_SCALE = DESKTOP_HOME_INTRO_REFERENCE_SCALE;
const INTRO_ZOOM_OUT_DURATION = 5.25;
const INTRO_HOME_SETTLE_SCALE_DURATION = 0.42;
const MOBILE_INTRO_HOME_SETTLE_SCALE_DURATION = 0.72;
const INTRO_HOME_COMPLETION_LEAD = 0.16;
const VIDEO_HANDOFF_FADE_DURATION = 0.18;
const VIDEO_HANDOFF_IN_FADE_DURATION = VIDEO_HANDOFF_FADE_DURATION;
const VIDEO_HANDOFF_IN_START_OPACITY = 0.04;
const SECTION_MEDIA_FADE_IN_DURATION = 0.38;
const SECTION_MEDIA_FADE_OUT_DURATION = 0.34;
const CONTACT_VIDEO_BASE_FILTER = 'brightness(1.06) contrast(1.035) saturate(1.02)';
const CONTACT_VIDEO_POSITION_HORIZONTAL = '62% center';
const CONTACT_VIDEO_POSITION_VERTICAL = 'center 58%';
const ABOUT_INTRO_COMPLETION_LEAD_MOBILE = 0.22;
const CONTACT_INTRO_COMPLETION_LEAD = 0.4;
const CONTACT_INTRO_COMPLETION_LEAD_MOBILE = 0.08;
// Contact's source artwork is larger than the shared Enso equilibrium frame.
// These scales make its intro begin, and its outro finish, at the same visual size.
const CONTACT_HANDOFF_SCALE_DESKTOP = 0.74;
const CONTACT_HANDOFF_SCALE_MOBILE = 0.84;
const CONTACT_EXTRO_MEDIA_DURATION = 2.836;
const CONTACT_EXTRO_DURATION = 2.35;
const CONTACT_EXTRO_EQUILIBRIUM_LEAD = 0.12;
const PORTFOLIO_LOGO_ZOOM_SCALE = 3.45;
const PORTFOLIO_LOGO_ZOOM_SCALE_MOBILE = 2.6;
const DESKTOP_NO_VIDEO_LOGO_ZOOM_RATIO = 3.78;
const PORTFOLIO_LOGO_ZOOM_IN_DURATION = 0.62;
const PORTFOLIO_LOGO_ZOOM_OUT_DURATION = 0.66;
const PORTFOLIO_LOGO_FADE_DURATION = 0.38;
const PORTFOLIO_LOGO_FADE_START = 0.18;
const DESKTOP_HOME_RETURN_REFERENCE_SCALE = DESKTOP_HANDOFF_EQUILIBRIUM_SCALE;
const DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE = DESKTOP_HANDOFF_EQUILIBRIUM_SCALE;
const DESKTOP_SECTION_HOME_RETURN_SCALE = DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE;
const DESKTOP_HOME_INTRO_HANDOFF_DURATION = 0.88;
const DESKTOP_SECTION_CHAIN_INTRO_HANDOFF_DURATION = 0.56;
const DESKTOP_SECTION_CHAIN_EQUILIBRIUM_SCALE = DESKTOP_HANDOFF_EQUILIBRIUM_SCALE;
const DESKTOP_SECTION_CHAIN_REVERSE_COMPLETION_LEAD = 1.28;
const DESKTOP_SERVICES_CHAIN_REVERSE_COMPLETION_LEAD = 0.72;
const DESKTOP_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD = 0.58;
const DESKTOP_SECTION_CHAIN_REVERSE_SETTLE_DURATION = 0.36;
const MOBILE_SECTION_CHAIN_REVERSE_SETTLE_DURATION = 0.28;
const MOBILE_SECTION_CHAIN_REVERSE_COMPLETION_LEAD = 0.22;
const MOBILE_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD = 1.32;
const MOBILE_CONTACT_ABOUT_REVERSE_COMPLETION_LEAD = 0.035;
const MOBILE_SERVICES_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD = 0.08;
const MOBILE_CONTACT_CHAIN_INTRO_START_TIME = 0;
const MOBILE_ABOUT_CHAIN_INTRO_START_TIME = 0.12;
const DESKTOP_ABOUT_CHAIN_INTRO_START_TIME = 0;
const DESKTOP_HOME_DIRECT_INTRO_SOURCES = {};
const DESKTOP_HOME_DIRECT_INTRO_START_TIMES = {
    about: 0,
    contact: 0,
    services: 0
};
const DESKTOP_HOME_DIRECT_INTRO_DURATIONS = {
    about: 0.88,
    contact: 0.7,
    services: 0.84
};
const HOME_EQUILIBRIUM_STATES = new Set(['scatter', 'intro', 'stabilize', 'mobile-landing', 'mobile-nav']);
const CINEMATIC_SECTION_STATES = new Set(['about', 'services', 'portfolios', 'blogs', 'contact']);
const USE_DESKTOP_CINEMATIC_ON_MOBILE = true;
const MOBILE_SERVICES_LABEL_REVEAL_DELAY = 2.2;
const HOME_VIDEO_POINTER_PARALLAX_ENABLED = false;
const PORTFOLIO_CURSOR_PARALLAX_ENABLED = false;
let videoTransitionToken = 0;
let pendingVideoTimeout = null;
let activeLocomotiveId = null;
let isRoutingThroughHome = false;
let shouldSeamlesslyStartNextIntro = false;
let pendingSeamlessIntroTransform = null;
let queuedSectionTransitionTarget = null;
let isBlogArticleOverlayOpen = false;
let mobileIntroFallbackTimeout = null;
let mobileCompositionLock = null;

const MOBILE_COMPOSITION_WIDTH_THRESHOLD = 48;

function getHomeLogoDisplayScale() {
    // Master home-logo scale switch. Mobile and desktop use different base scales.
    return isMobile ? HOME_LOGO_DISPLAY_SCALE : DESKTOP_HOME_LOGO_DISPLAY_SCALE;
}

function getMobileUniformCinematicScale() {
    // Shared mobile scale for sections that should match the home/logo framing.
    return MOBILE_UNIFORM_CINEMATIC_SCALE;
}

function getMobileCinematicScaleForPage(pageId = '') {
    // Per-page mobile scale override. Change constants above, not this function.
    if (pageId === 'about') return ABOUT_MOBILE_CINEMATIC_SCALE;
    if (pageId === 'contact') return CONTACT_MOBILE_CINEMATIC_SCALE;
    return getMobileUniformCinematicScale();
}

function getMobileServicesMediaScale() {
    // Keep this matched with the mobile CSS transform on #services-bg-video / #services-loop-video.
    const cssScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-services-media-scale'));
    return Number.isFinite(cssScale) && cssScale > 0 ? cssScale : MOBILE_SERVICES_MEDIA_SCALE;
}

function getRevealHomeVideoScale(reverseSrc = '') {
    if (isMobile) return getHomeLogoDisplayScale();
    return reverseSrc ? DESKTOP_SECTION_HOME_RETURN_SCALE : getHomeLogoDisplayScale();
}

function getVisibleHomeSourceScale() {
    if (isMobile) return getHomeLogoDisplayScale();
    return getPrimaryVideoScale(HOME_EQUILIBRIUM_SCALE);
}

function getDesktopHomeDirectIntroStartTime(pageId) {
    if (isMobile) return 0;
    if (DESKTOP_HOME_DIRECT_INTRO_SOURCES[pageId]) return 0;
    return DESKTOP_HOME_DIRECT_INTRO_START_TIMES[pageId] ?? 0;
}

function getDesktopHomeDirectVideoSrc(pageId) {
    if (isMobile) return getVideoSrc(pageId);
    return DESKTOP_HOME_DIRECT_INTRO_SOURCES[pageId] || getVideoSrc(pageId);
}

function getDesktopHomeDirectIntroDuration(pageId) {
    // Desktop-only home-to-section intro speed map; values live in DESKTOP_HOME_DIRECT_INTRO_DURATIONS.
    if (isMobile) return DESKTOP_HOME_INTRO_HANDOFF_DURATION;
    return DESKTOP_HOME_DIRECT_INTRO_DURATIONS[pageId] ?? DESKTOP_HOME_INTRO_HANDOFF_DURATION;
}

function getContactExtroPlaybackRate() {
    // Contact desktop extro speed = source media duration divided by desired visible duration.
    return CONTACT_EXTRO_MEDIA_DURATION / CONTACT_EXTRO_DURATION;
}

function getContactHandoffScale() {
    return isMobile ? CONTACT_HANDOFF_SCALE_MOBILE : CONTACT_HANDOFF_SCALE_DESKTOP;
}


function queueSectionTransition(pageId) {
    if (!pageId || pageId === state) return;
    queuedSectionTransitionTarget = pageId;
    warmTransitionForPage(pageId);
    warmPageResources(pageId);
}

function runQueuedSectionTransition() {
    const queuedTarget = queuedSectionTransitionTarget;
    queuedSectionTransitionTarget = null;
    if (!queuedTarget || queuedTarget === state) return;
    requestAnimationFrame(() => startVideoTransition(queuedTarget));
}

function updateAboutTeamVideoFocus() {
    const aboutSection = document.getElementById('about-section');
    const inlineTeam = document.getElementById('about-team-inline');
    if (!aboutSection || !inlineTeam) {
        document.body.classList.remove('about-team-focus');
        return;
    }

    const fadeStart = Math.max(0, inlineTeam.offsetTop - Math.min(window.innerHeight * 0.62, 500));
    const shouldFocusTeam = state === 'about'
        && aboutSection.classList.contains('active')
        && aboutSection.scrollTop >= fadeStart;
    document.body.classList.toggle('about-team-focus', shouldFocusTeam);
}

function finishForwardSectionTransition(ownerToken = null) {
    if (ownerToken !== null && ownerToken !== videoTransitionToken) return;
    isAnimating = false;
    runQueuedSectionTransition();
}

const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const locomotiveRegistry = {};
const locomotiveSectionMap = [
    { id: 'blogs-section', selectors: ['.blogs-container'] },
    { id: 'blog-article-overlay', selectors: ['.blog-article-content'] }
];

function writeMobileCompositionLock(lock) {
    const root = document.documentElement;
    if (!root || !lock) return;

    root.style.setProperty('--mobile-lock-w', `${lock.width}px`);
    root.style.setProperty('--mobile-lock-h', `${lock.height}px`);
    root.style.setProperty('--mobile-lock-vw', `${lock.width / 100}px`);
    root.style.setProperty('--mobile-lock-vh', `${lock.height / 100}px`);
    document.body.classList.add('mobile-composition-locked');
}

function lockMobileComposition({ force = false } = {}) {
    if (!isMobile) return false;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const hasLock = Boolean(mobileCompositionLock);
    const widthDelta = hasLock ? Math.abs(width - mobileCompositionLock.width) : Infinity;
    const orientationChanged = hasLock
        ? ((width > height) !== (mobileCompositionLock.width > mobileCompositionLock.height))
        : false;
    const shouldRefreshLock = force || !hasLock || widthDelta > MOBILE_COMPOSITION_WIDTH_THRESHOLD || orientationChanged;

    if (shouldRefreshLock) {
        mobileCompositionLock = { width, height };
    }

    writeMobileCompositionLock(mobileCompositionLock);
    return shouldRefreshLock;
}

function releaseMobileCompositionLock() {
    mobileCompositionLock = null;
    document.body.classList.remove('mobile-composition-locked');

    const root = document.documentElement;
    if (!root) return;

    root.style.removeProperty('--mobile-lock-w');
    root.style.removeProperty('--mobile-lock-h');
    root.style.removeProperty('--mobile-lock-vw');
    root.style.removeProperty('--mobile-lock-vh');
}

function setHeroNavReady(isReady) {
    document.body.classList.toggle('hero-nav-ready', Boolean(isReady));
}

function canUseLocomotiveScroll() {
    return typeof window.LocomotiveScroll === 'function' && !prefersReducedMotionQuery.matches;
}

function buildLocomotiveShell(rootEl, selectors) {
    if (!rootEl) return null;

    const existingShell = rootEl.querySelector(':scope > .loco-scroll-shell');
    if (existingShell) {
        return {
            shell: existingShell,
            content: existingShell.querySelector('.loco-scroll-content')
        };
    }

    const nodesToMove = selectors
        .map((selector) => rootEl.querySelector(selector))
        .filter(Boolean);

    if (!nodesToMove.length) return null;

    const shell = document.createElement('div');
    shell.className = 'loco-scroll-shell';

    const content = document.createElement('div');
    content.className = 'loco-scroll-content';
    content.setAttribute('data-scroll-container', '');

    shell.appendChild(content);
    rootEl.insertBefore(shell, nodesToMove[0]);

    nodesToMove.forEach((node) => content.appendChild(node));
    rootEl.classList.add('loco-ready');

    return { shell, content };
}

function prepareLocomotiveSections() {
    locomotiveSectionMap.forEach(({ id, selectors }) => {
        const section = document.getElementById(id);
        if (!section) return;

        const shellData = buildLocomotiveShell(section, selectors);
        locomotiveRegistry[id] = {
            section,
            shell: shellData ? shellData.shell : null,
            content: shellData ? shellData.content : null,
            instance: null
        };
    });

}

function createLocomotiveInstance(sectionId) {
    const config = locomotiveRegistry[sectionId];
    if (!config || config.instance || !config.content || !canUseLocomotiveScroll()) return config ? config.instance : null;

    config.instance = new window.LocomotiveScroll({
        el: config.content,
        smooth: true,
        lerp: 0.085,
        multiplier: 0.9,
        tablet: {
            smooth: true
        },
        smartphone: {
            smooth: true
        }
    });

    return config.instance;
}

function updateLocomotiveSection(sectionId) {
    const config = locomotiveRegistry[sectionId];
    if (!config || !config.instance) return;

    requestAnimationFrame(() => {
        config.instance.update();
    });
}

function resetSectionScrollPosition(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollTop = 0;
    }

    const config = locomotiveRegistry[sectionId];
    if (!config) return;

    if (config.instance) {
        config.instance.scrollTo(0, { duration: 0, disableLerp: true });
        config.instance.update();
        return;
    }

    if (config.shell) {
        config.shell.scrollTop = 0;
    }
}

function deactivateLocomotiveSection(sectionId, { reset = false } = {}) {
    const section = document.getElementById(sectionId);
    const config = locomotiveRegistry[sectionId];
    if (!config) {
        if (reset && section) section.scrollTop = 0;
        return;
    }

    if (config.instance) {
        if (reset) {
            config.instance.scrollTo(0, { duration: 0, disableLerp: true });
        }
        config.instance.stop();
    } else if (reset && config.shell) {
        config.shell.scrollTop = 0;
    }

    // Remove loco-active so native scroll is re-enabled on the shell
    if (config.section) config.section.classList.remove('loco-active');

    if (activeLocomotiveId === sectionId) {
        activeLocomotiveId = null;
    }
}

function suspendAllLocomotiveSections(options = {}) {
    Object.keys(locomotiveRegistry).forEach((sectionId) => {
        deactivateLocomotiveSection(sectionId, options);
    });
}

function activateLocomotiveSection(sectionId, { reset = false } = {}) {
    const section = document.getElementById(sectionId);
    const config = locomotiveRegistry[sectionId];
    if (!config) {
        if (reset && section) section.scrollTop = 0;
        return;
    }

    Object.keys(locomotiveRegistry).forEach((id) => {
        if (id !== sectionId) {
            deactivateLocomotiveSection(id);
        }
    });

    if (!canUseLocomotiveScroll()) {
        if (reset && config.shell) config.shell.scrollTop = 0;
        activeLocomotiveId = sectionId;
        return;
    }

    const instance = createLocomotiveInstance(sectionId);
    if (!instance) return;

    // Add loco-active so CSS locks out native scroll on the shell,
    // preventing double-scroll that causes the bottom gap
    if (config.section) config.section.classList.add('loco-active');

    requestAnimationFrame(() => {
        instance.update();
        if (reset) {
            instance.scrollTo(0, { duration: 0, disableLerp: true });
        }
        instance.start();
        activeLocomotiveId = sectionId;
    });
}

function getCurrentScrollableSectionId() {
    if (isBlogArticleOverlayOpen) return 'blog-article-overlay';
    if (detailOverlay && detailOverlay.classList.contains('active')) return null;
    if (typeof isTeamSectionVisible === 'function' && isTeamSectionVisible()) return 'team-section';

    const currentSectionId = `${state}-section`;
    if (locomotiveRegistry[currentSectionId]) return currentSectionId;

    return null;
}

function resumeCurrentScrollableSection(options = {}) {
    const sectionId = getCurrentScrollableSectionId();
    if (sectionId) {
        activateLocomotiveSection(sectionId, options);
    }
}

function getBlogSectionAnimationTargets() {
    return gsap.utils.toArray('#blogs-section .blogs-container h1, #blogs-section .blog-card, #blogs-section .blog-social-icons');
}

function animateBlogSectionIn() {
    const section = document.getElementById('blogs-section');
    const targets = getBlogSectionAnimationTargets();
    if (!section) return;

    hydrateLazyImages(section);
    section.scrollTop = 0;
    const blogShell = locomotiveRegistry['blogs-section']?.shell;
    if (blogShell) blogShell.scrollTop = 0;
    gsap.killTweensOf(section);
    gsap.killTweensOf(targets);
    gsap.set(targets, { opacity: 0, y: 32 });
    gsap.to(section, { opacity: 1, duration: 0.55, ease: "power2.out" });
    gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.65,
        stagger: 0.08,
        delay: 0.1,
        ease: "power3.out",
        clearProps: "transform"
    });
}

function animateBlogSectionOut() {
    const section = document.getElementById('blogs-section');
    const targets = getBlogSectionAnimationTargets();
    if (!section) return;

    gsap.killTweensOf(section);
    gsap.killTweensOf(targets);
    gsap.to(targets, {
        opacity: 0,
        y: 24,
        duration: 0.22,
        stagger: {
            each: 0.025,
            from: "end"
        },
        ease: "power2.in"
    });
    gsap.to(section, { opacity: 0, duration: 0.3, ease: "power2.in" });
}

function setElementInteractivity(element, isInteractive) {
    if (!element) return;

    element.style.pointerEvents = isInteractive ? 'auto' : 'none';
    element.setAttribute('aria-hidden', isInteractive ? 'false' : 'true');

    if ('inert' in element) {
        element.inert = !isInteractive;
        return;
    }

    if (isInteractive) {
        element.removeAttribute('inert');
    } else {
        element.setAttribute('inert', '');
    }
}

function hydrateLazyBackgrounds(root = document) {
    if (!root) return;

    root.querySelectorAll('[data-bg-lazy]').forEach((element) => {
        const src = element.dataset.bgLazy;
        if (!src || element.dataset.bgLoaded === 'true') return;

        element.style.backgroundImage = `url('${src}')`;
        element.dataset.bgLoaded = 'true';
    });
}

function hydrateLazyImages(root = document) {
    if (!root) return;

    root.querySelectorAll('img[data-src]').forEach((image) => {
        const src = image.dataset.src;
        if (!src || image.dataset.srcLoaded === 'true') return;

        image.src = src;
        image.dataset.srcLoaded = 'true';
    });
}

function initializeLayerInteractivity() {
    document.querySelectorAll('.scroll-section').forEach((section) => {
        const isActive = section.classList.contains('active');
        setElementInteractivity(section, isActive);
        if (!isActive) {
            gsap.set(section, { autoAlpha: 0, visibility: 'hidden' });
        }
    });

    setElementInteractivity(document.getElementById('team-detail-overlay'), false);
    setElementInteractivity(document.getElementById('blog-article-overlay'), false);
    setElementInteractivity(document.querySelector('.about-content'), false);
}

function hideSection(section, { duration = 0.3, immediate = false } = {}) {
    if (!section) return;

    gsap.killTweensOf(section);
    section.classList.remove('active');
    if (section.id === 'about-section') {
        document.body.classList.remove('about-team-focus');
    }
    if (section.id === 'contact-section') {
        document.body.classList.remove('contact-form-focus');
    }
    setElementInteractivity(section, false);
    if (section.id === 'portfolios-section') {
        pausePortfolioVideos();
        unmountPortfolioVideos();
    }

    if (immediate) {
        gsap.set(section, { autoAlpha: 0, visibility: 'hidden' });
        return;
    }

    gsap.to(section, {
        autoAlpha: 0,
        duration,
        ease: "power2.in",
        onComplete: () => gsap.set(section, { visibility: 'hidden' })
    });
}

function settleSectionsForHome() {
    document.querySelectorAll('.scroll-section').forEach((section) => {
        if (section.id === 'team-section') return;
        hideSection(section, { immediate: true });
    });

    const aboutContent = document.querySelector('.about-content');
    if (aboutContent) {
        setElementInteractivity(aboutContent, false);
        gsap.killTweensOf(aboutContent);
        gsap.set(aboutContent, { opacity: 0, scale: 1, pointerEvents: 'none' });
    }

    hideTeamDetailOverlay();
    hideTeamSection({ reset: true });
    document.body.classList.remove('about-team-focus');
    gsap.set(['#services-loop-video', '#services-bg-video'], { opacity: 0, visibility: 'hidden' });
    gsap.set(['.services-text-overlay', '.services-gradient-overlay'], { opacity: 0 });
}

function showSection(section, { duration = 0.67 } = {}) {
    if (!section) return;

    gsap.killTweensOf(section);
    section.classList.add('active');
    setElementInteractivity(section, true);
    gsap.set(section, { visibility: 'visible' });
    gsap.to(section, { autoAlpha: 1, duration, ease: "power2.out" });
    if (section.id === 'about-section') {
        updateAboutTeamVideoFocus();
    } else {
        document.body.classList.remove('about-team-focus');
    }
    if (section.id === 'portfolios-section') {
        requestPortfolioPlaybackSync();
    }
}

function getPortfolioLogoZoomScale() {
    return isMobile ? PORTFOLIO_LOGO_ZOOM_SCALE_MOBILE : PORTFOLIO_LOGO_ZOOM_SCALE;
}

function getNoVideoLogoZoomScale(startScale = getHomeLogoDisplayScale()) {
    if (isMobile) return getMobileUniformCinematicScale();
    const normalizedScale = Number.isFinite(startScale) && startScale > 0 ? startScale : getHomeLogoDisplayScale();
    return Math.min(getPortfolioLogoZoomScale(), normalizedScale * DESKTOP_NO_VIDEO_LOGO_ZOOM_RATIO);
}function revealPortfolioSectionContent(section, { transitionOwnerToken = null, duration = 0.72 } = {}) {
    if (transitionOwnerToken !== null && transitionOwnerToken !== videoTransitionToken) return;
    if (!section) return;

    section.scrollTop = 0;
    showSection(section, { duration });

    if (locomotiveRegistry[section.id]) {
        activateLocomotiveSection(section.id, { reset: true });
    }

    gsap.fromTo('.portfolio-item',
        { opacity: 0, y: 34 },
        { opacity: 1, y: 0, stagger: 0.085, duration: 0.92, ease: "sine.out", delay: 0.08, overwrite: true }
    );
    schedulePortfolioWarmup({ force: true });
    requestPortfolioPlaybackSync();
}

function revealNoVideoSectionContent(pageId, section, { transitionOwnerToken = null, duration = 0.72 } = {}) {
    if (transitionOwnerToken !== null && transitionOwnerToken !== videoTransitionToken) return;
    if (!section) return;

    if (pageId === 'portfolios') {
        waitForTransitionAudioToFinish('portfolios', transitionOwnerToken, () => {
            revealPortfolioSectionContent(section, { transitionOwnerToken, duration });
        });
        return;
    }

    if (pageId === 'blogs') {
        gsap.set(section, { visibility: 'visible', autoAlpha: 0 });
        section.classList.add('active');
        setElementInteractivity(section, true);
        animateBlogSectionIn();
        if (locomotiveRegistry[section.id]) {
            activateLocomotiveSection(section.id, { reset: true });
        }
        return;
    }

    showSection(section, { duration });
    if (locomotiveRegistry[section.id]) {
        activateLocomotiveSection(section.id, { reset: true });
    }
}

function animateNoVideoLogoIntro(pageId, transitionOwnerToken, onComplete) {
    const section = document.getElementById(`${pageId}-section`);
    const complete = () => {
        if (transitionOwnerToken === videoTransitionToken && typeof onComplete === 'function') {
            onComplete();
        }
    };

    if (!videoEl || typeof gsap === 'undefined') {
        revealNoVideoSectionContent(pageId, section, { transitionOwnerToken });
        complete();
        return;
    }

    if (section) {
        gsap.killTweensOf(section);
        section.classList.remove('active');
        setElementInteractivity(section, false);
        gsap.set(section, { autoAlpha: 0, visibility: 'visible' });
        section.scrollTop = 0;
    }

    const startScale = isMobile
        ? getPrimaryVideoScale(getMobileUniformCinematicScale())
        : DESKTOP_HANDOFF_EQUILIBRIUM_SCALE;
    const zoomScale = Math.max(getNoVideoLogoZoomScale(startScale), startScale);

    gsap.killTweensOf(videoEl);
    gsap.set(videoEl, {
        opacity: 1,
        scale: startScale,
        x: 0,
        y: '0vh',
        filter: 'blur(0px)',
        transformOrigin: '50% 50%',
        objectPosition: 'center center'
    });

    gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: () => {
            if (transitionOwnerToken !== videoTransitionToken) return;
            gsap.set(videoEl, {
                opacity: 0,
                scale: zoomScale,
                x: 0,
                y: '0vh',
                clearProps: 'filter'
            });
            revealNoVideoSectionContent(pageId, section, {
                transitionOwnerToken,
                duration: 0.78
            });
            complete();
        }
    })
        .to(videoEl, {
            scale: zoomScale,
            duration: PORTFOLIO_LOGO_ZOOM_IN_DURATION,
            ease: "power3.in"
        }, 0)
        .to(videoEl, {
            opacity: 0,
            filter: 'blur(8px)',
            duration: PORTFOLIO_LOGO_FADE_DURATION,
            ease: "sine.inOut"
        }, PORTFOLIO_LOGO_FADE_START);
}

function animatePortfolioLogoIntro(transitionOwnerToken, onComplete) {
    animateNoVideoLogoIntro('portfolios', transitionOwnerToken, onComplete);
}

function animatePortfolioLogoExit({ scale, x = 0, y = '0vh', transitionOwnerToken = null } = {}) {
    if (!videoEl || typeof gsap === 'undefined') return;

    const targetScale = scale ?? getHomeLogoDisplayScale();
    const zoomScale = isMobile ? targetScale : Math.max(getNoVideoLogoZoomScale(targetScale), getPrimaryVideoScale(targetScale));

    gsap.killTweensOf(videoEl);
    gsap.set(videoEl, {
        opacity: 0,
        scale: zoomScale,
        x: 0,
        y: '0vh',
        filter: 'blur(8px)',
        transformOrigin: '50% 50%',
        objectPosition: 'center center'
    });
    gsap.to(videoEl, {
        opacity: 1,
        scale: targetScale,
        x,
        y,
        filter: 'blur(0px)',
        duration: PORTFOLIO_LOGO_ZOOM_OUT_DURATION,
        ease: "power3.out",
        overwrite: true,
        onComplete: () => {
            if (transitionOwnerToken !== null && transitionOwnerToken !== videoTransitionToken) return;
            gsap.set(videoEl, { clearProps: 'filter' });
        }
    });
}

function getBlogArticleAnimationTargets() {
    return gsap.utils.toArray('#blog-article-overlay .detail-close-btn, #blog-article-overlay .blog-article-panel.active > *');
}

initializeLayerInteractivity();
prepareLocomotiveSections();
if (isMobile) {
    lockMobileComposition({ force: true });
}

// --- CUSTOM CURSOR SETUP ---
const CURSOR_GLOW_ENABLED = !isMobile;
const CUSTOM_CURSOR_ENABLED = false;
const cursorDot = CUSTOM_CURSOR_ENABLED ? document.createElement('div') : null;
if (cursorDot) {
    cursorDot.id = 'custom-cursor-dot';
}
const cursorRing = CUSTOM_CURSOR_ENABLED ? document.createElement('div') : null;
if (cursorRing) {
    cursorRing.id = 'custom-cursor-ring';
}
if (cursorDot && cursorRing) {
    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorRing);
}

let mouseX = 0, mouseY = 0;
let mouseX_raw = 0, mouseY_raw = 0;
let ringX = 0, ringY = 0;
let lastSparkleTime = 0;
const mouseGlow = document.getElementById('mouse-glow');
const videoContainer = document.getElementById('video-container');
let handoffVideoBuffer = null;
let pendingAmbientPointer = null;
let ambientPointerFrame = null;
const sectionMediaWarmupMap = {
    services: ['services-bg-video', 'services-loop-video']
};
let muxPlayerLoadPromise = null;
let backgroundWarmupScheduled = false;
const transitionWarmRegistry = new Set();
const transitionPreloadElements = [];
const MOBILE_WARM_SPACING = 360;
const DESKTOP_WARM_SPACING = 140;

function getServicesCinematicSource(kind = 'intro') {
    if (isMobile && kind === 'intro') {
        return './videos/vertical utility services continuous mobile.mp4';
    }

    const orientation = isMobile ? 'vertical' : (window.innerWidth > window.innerHeight ? 'horizontal' : 'vertical');
    const suffix = kind === 'loop' ? ' loop' : '';
    return `./videos/${orientation} utility${suffix}.mp4`;
}

function configureServicesCinematicSources() {
    const servicesVideo = document.getElementById('services-bg-video');
    const servicesLoop = document.getElementById('services-loop-video');
    const nextSources = [
        [servicesVideo, getServicesCinematicSource('intro')],
        [servicesLoop, getServicesCinematicSource('loop')]
    ];

    nextSources.forEach(([video, src]) => {
        if (!video || !src || videoUsesSource(video, src)) return;
        video.src = src;
        video.load();
    });
}

function primeVideoElement(video) {
    if (!video || video.dataset.preloaded === 'true') return;

    // Keep the initial HTML light, then explicitly allow background fetches later.
    video.preload = 'auto';
    video.dataset.preloaded = 'true';
    video.load();
}

function primeSectionMedia(pageId) {
    if (pageId === 'services') {
        configureServicesCinematicSources();
    }

    const videoIds = pageId === 'services'
        ? ['services-bg-video', 'services-loop-video']
        : sectionMediaWarmupMap[pageId];
    if (!videoIds) return;

    videoIds.forEach((id) => {
        primeVideoElement(document.getElementById(id));
    });
}

function ensureMuxPlayerLoaded() {
    if (window.customElements && window.customElements.get('mux-player')) {
        return Promise.resolve();
    }

    if (muxPlayerLoadPromise) {
        return muxPlayerLoadPromise;
    }

    muxPlayerLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mux/mux-player';
        script.onload = () => resolve();
        script.onerror = () => {
            muxPlayerLoadPromise = null;
            reject(new Error('Failed to load mux-player'));
        };
        document.head.appendChild(script);
    });

    return muxPlayerLoadPromise;
}

function preloadVideoSource(src) {
    if (!src || transitionWarmRegistry.has(src)) return;

    transitionWarmRegistry.add(src);

    const preloadVideo = document.createElement('video');
    preloadVideo.preload = 'auto';
    preloadVideo.muted = true;
    preloadVideo.playsInline = true;
    preloadVideo.src = src;
    preloadVideo.load();
    transitionPreloadElements.push(preloadVideo);
}

function warmTransitionForPage(pageId, reverse = false) {
    if (!pageId) return;
    const sources = [];

    if (pageId === 'services' && !reverse) {
        sources.push(
            getServicesCinematicSource('intro'),
            getServicesCinematicSource('loop')
        );
    } else {
        sources.push(getVideoSrc(pageId, reverse));
    }
    if (!reverse && !isMobile && DESKTOP_HOME_DIRECT_INTRO_SOURCES[pageId]) {
        sources.push(DESKTOP_HOME_DIRECT_INTRO_SOURCES[pageId]);
    }

    sources.filter(Boolean).forEach(preloadVideoSource);
}

function warmTransitionVideos() {
    const mobileTransitionSources = [
        './videos/intro.mp4',
        './videos/about vertical.mp4',
        './videos/about vertical reverse.mp4',
        './videos/vertical utility.mp4',
        './videos/vertical utility loop.mp4',
        './videos/vertical utility home reverse.mp4',
        './videos/contact vertical.mp4',
        './videos/contact vertical reverse.mp4'
    ];
    const desktopTransitionSources = [
        './videos/intro.mp4',
        './videos/about horizontal.webm',
        './videos/about horizontal reverse.mp4',
        './videos/horizontal utility.mp4',
        './videos/horizontal utility loop.mp4',
        './videos/horizontal utility home reverse.mp4',
        './videos/contact horizontal.webm',
        './videos/contact horizontal reverse.mp4'
    ];
    const transitionSources = [
        getVideoSrc('about'),
        getVideoSrc('about', true),
        getVideoSrc('services', true),
        getVideoSrc('contact'),
        getVideoSrc('contact', true),
        ...(isMobile ? mobileTransitionSources : desktopTransitionSources)
    ].filter(Boolean);

    const spacing = isMobile ? MOBILE_WARM_SPACING : DESKTOP_WARM_SPACING;
    const scheduleWarmSource = (src, delay, attempt = 0) => {
        setTimeout(() => {
            if (isAnimating && attempt < 8) {
                scheduleWarmSource(src, spacing, attempt + 1);
                return;
            }
            preloadVideoSource(src);
        }, delay);
    };

    transitionSources.forEach((src, index) => {
        scheduleWarmSource(src, index * spacing);
    });
}

function warmPageResources(pageId) {
    primeSectionMedia(pageId);

    if (pageId === 'blogs') {
        const blogsSection = document.getElementById('blogs-section');
        hydrateLazyImages(blogsSection);
    }

    if (pageId === 'portfolios') {
        schedulePortfolioWarmup();
    }
}

function normalizePrimaryVideoState(options = {}) {
    if (!videoEl) return;

    const {
        opacity = null,
        scale = null,
        x = null,
        y = null,
        filter = null,
        objectPosition = 'center center',
        playbackRate = 1
    } = options;

    gsap.killTweensOf(videoEl);
    const statePatch = {
        transformOrigin: '50% 50%',
        objectPosition
    };

    if (opacity !== null) statePatch.opacity = opacity;
    if (scale !== null) statePatch.scale = scale;
    if (x !== null) statePatch.x = x;
    if (y !== null) statePatch.y = y;
    if (filter !== null) {
        statePatch.filter = filter;
    } else {
        statePatch.clearProps = 'filter';
    }

    gsap.set(videoEl, statePatch);
    videoEl.playbackRate = playbackRate;
}

function getPrimaryVideoScale(fallback = HOME_LOGO_DISPLAY_SCALE) {
    if (!videoEl || typeof gsap === 'undefined') return fallback;
    const scale = Number(gsap.getProperty(videoEl, 'scale'));
    return Number.isFinite(scale) && scale > 0 ? scale : fallback;
}

function scheduleBackgroundWarmup() {
    if (backgroundWarmupScheduled) return;
    backgroundWarmupScheduled = true;

    const startWarmup = () => {
        const warmQueue = [
            () => warmTransitionVideos(),
            () => warmPageResources('about'),
            () => warmPageResources('services'),
            () => warmPageResources('contact'),
            () => warmPageResources('blogs'),
            () => warmPageResources('portfolios')
        ];

        warmQueue.forEach((task, index) => {
            setTimeout(task, index * 700);
        });
    };

    const queueWarmup = () => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(startWarmup, { timeout: 2000 });
            return;
        }

        setTimeout(startWarmup, 0);
    };

    setTimeout(queueWarmup, isMobile ? 350 : 700);
}

function shouldRouteSectionTransitionThroughHome(pageId) {
    if (isRoutingThroughHome || isAnimating) return false;
    if (!CINEMATIC_SECTION_STATES.has(pageId)) return false;
    if (!CINEMATIC_SECTION_STATES.has(state)) return false;
    if (state === pageId) return false;
    // Blogs has no reverse media of its own, but cinematic sections must still
    // complete their outro before Blogs performs its content reveal.
    if (state === 'blogs') return false;
    if (HOME_EQUILIBRIUM_STATES.has(state)) return false;
    return true;
}

function routeSectionTransitionThroughHome(pageId) {
    // Section-to-section routes go through a reverse/extro first, then into the next intro.
    // To tune this path, use the CHAIN constants above:
    // - reverse completion lead controls when the outgoing extro stops.
    // - intro start time controls where the next intro begins.
    // - handoff fade constants control how softly the two videos crossfade.
    const fromPageId = state;
    isRoutingThroughHome = true;
    shouldSeamlesslyStartNextIntro = false;
    pendingSeamlessIntroTransform = null;
    warmTransitionForPage(fromPageId, true);
    warmTransitionForPage(pageId);
    warmPageResources(pageId);

    if (isMobile && fromPageId === 'contact' && pageId === 'services') {
        const homeStableTransform = { scale: getContactHandoffScale(), x: 0, y: '0vh' };
        executeFinalReverse({
            revealHomeUi: false,
            chainedTargetPageId: pageId,
            equilibriumTransform: homeStableTransform,
            reverseEndTransform: homeStableTransform,
            onHomeSettled: () => {
                shouldSeamlesslyStartNextIntro = false;
                pendingSeamlessIntroTransform = null;
                isRoutingThroughHome = false;
                startVideoTransition(pageId);
            }
        });
        return;
    }

    const nextIntroOffset = getResolvedIntroHandoffOffset(pageId, true);
    const nextIntroEquilibriumTransform = {
        scale: pageId === 'contact'
            ? getContactHandoffScale()
            : (isMobile
                ? getMobileCinematicScaleForPage(pageId)
                : DESKTOP_SECTION_CHAIN_EQUILIBRIUM_SCALE),
        x: nextIntroOffset.x,
        y: nextIntroOffset.y
    };
    const contactToAboutMobile = isMobile && fromPageId === 'contact' && pageId === 'about';
    const contactToServicesMobile = isMobile && fromPageId === 'contact' && pageId === 'services';
    const nextIntroStartTransform = (contactToAboutMobile || contactToServicesMobile)
        ? { ...nextIntroEquilibriumTransform, scale: getContactHandoffScale() }
        : nextIntroEquilibriumTransform;
    const reverseEndTransform = fromPageId === 'contact'
        ? (pageId === 'about' ? nextIntroStartTransform : { scale: getContactHandoffScale(), x: 0, y: 0 })
        : (fromPageId === 'about'
            ? {
                scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage('about') : 1),
                x: Number(gsap.getProperty(videoEl, 'x')) || 0,
                y: Number(gsap.getProperty(videoEl, 'y')) || 0
            }
            : nextIntroEquilibriumTransform);
    if (!isMobile && pageId !== 'services' && hasCinematicForwardVideo(pageId)) {
        const handoffOffset = getResolvedIntroHandoffOffset(pageId, true);
        primeBufferedHandoffVideo(getVideoSrc(pageId), {
            scale: nextIntroEquilibriumTransform.scale,
            x: handoffOffset.x,
            y: handoffOffset.y
        }, pageId === 'about' ? DESKTOP_ABOUT_CHAIN_INTRO_START_TIME : 0);
    } else if (isMobile && (pageId === 'about' || pageId === 'contact') && hasCinematicForwardVideo(pageId)) {
        primeBufferedHandoffVideo(
            getVideoSrc(pageId),
            nextIntroStartTransform,
            pageId === 'contact' ? MOBILE_CONTACT_CHAIN_INTRO_START_TIME : (pageId === 'about' ? MOBILE_ABOUT_CHAIN_INTRO_START_TIME : 0),
            { allowMobile: true }
        );
    }
    setHeroNavReady(!isMobile);

    executeFinalReverse({
        revealHomeUi: false,
        chainedTargetPageId: pageId,
        equilibriumTransform: nextIntroEquilibriumTransform,
        reverseEndTransform,
        onHomeSettled: () => {
            pendingSeamlessIntroTransform = nextIntroStartTransform;
            shouldSeamlesslyStartNextIntro = true;
            isRoutingThroughHome = false;
            startVideoTransition(pageId);
        }
    });
}

function consumeSeamlessIntroHandoff() {
    const shouldUseSeamlessHandoff = shouldSeamlesslyStartNextIntro;
    const handoffTransform = shouldUseSeamlessHandoff ? pendingSeamlessIntroTransform : null;
    shouldSeamlesslyStartNextIntro = false;
    pendingSeamlessIntroTransform = null;
    return {
        active: shouldUseSeamlessHandoff,
        transform: handoffTransform
    };
}

function getIntroHandoffOffset(pageId, isSeamlessHandoff) {
    return { x: 0, y: 0 };
}

function resolveViewportOffset(value, axis) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const numeric = parseFloat(value);
    if (!Number.isFinite(numeric)) return value;

    if (typeof value === 'string' && value.endsWith('vw')) {
        return (window.innerWidth * numeric) / 100;
    }

    if (typeof value === 'string' && value.endsWith('vh')) {
        return (window.innerHeight * numeric) / 100;
    }

    if (typeof value === 'string' && value.endsWith('px')) {
        return numeric;
    }

    return value;
}

function getResolvedIntroHandoffOffset(pageId, isSeamlessHandoff) {
    const offset = getIntroHandoffOffset(pageId, isSeamlessHandoff);
    return {
        x: resolveViewportOffset(offset.x, 'x'),
        y: resolveViewportOffset(offset.y, 'y')
    };
}

function setCustomCursorVisibility(isVisible, duration = 0.3) {
    if (CUSTOM_CURSOR_ENABLED && cursorDot && cursorRing) {
        gsap.to([cursorDot, cursorRing], { opacity: isVisible ? 1 : 0, duration });
    }
    if (CURSOR_GLOW_ENABLED && mouseGlow) {
        gsap.to(mouseGlow, { opacity: isVisible ? 0.1 : 0, duration });
    }
}

function getContactVideoObjectPosition() {
    // Contact crop/framing knob. Change CONTACT_VIDEO_POSITION_* constants above.
    return isVertical() ? CONTACT_VIDEO_POSITION_VERTICAL : CONTACT_VIDEO_POSITION_HORIZONTAL;
}

function lockContactVideoComposition({ resetTransform = true } = {}) {
    if (!videoEl || typeof gsap === 'undefined') return;
    videoEl.style.objectPosition = getContactVideoObjectPosition();
    const contactVideoState = {
        transformOrigin: '50% 50%'
    };

    if (resetTransform) {
        contactVideoState.x = 0;
        contactVideoState.y = '0vh';
        contactVideoState.scale = isMobile ? getMobileCinematicScaleForPage('contact') : 1;
    }

    gsap.set(videoEl, contactVideoState);
}

function getMobileContactSettleY() {
    // Mobile Contact final vertical settle.
    // Increase the returned value to move the handshake lower; decrease it to move higher.
    const lockedVh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-lock-vh'));
    const viewportUnit = Number.isFinite(lockedVh) && lockedVh > 0 ? lockedVh : window.innerHeight / 100;
    const narrowPhoneBoost = Math.max(0, 390 - window.innerWidth) * 1.7;
    return Math.round(Math.min(Math.max(viewportUnit * 18 + narrowPhoneBoost, 96), 260));
}

function slideMobileContactVideoDown() {
    if (!isMobile || !videoEl || typeof gsap === 'undefined') return;

    videoEl.style.objectPosition = getContactVideoObjectPosition();

    gsap.killTweensOf(videoEl);

    gsap.set(videoEl, {
        x: 0,
        y: 0,
        scale: getMobileCinematicScaleForPage('contact'),
        transformOrigin: '50% 50%'
    });

    gsap.to(videoEl, {
        y: getMobileContactSettleY(),
        scale: getMobileCinematicScaleForPage('contact'),
        duration: 1.1,
        ease: 'power3.inOut',
        overwrite: 'auto'
    });
}

function setContactVideoForegroundMode(isEnabled, { resetTransform = isEnabled || state === 'contact' } = {}) {
    document.body.classList.toggle('contact-video-foreground', Boolean(isEnabled));
    if (videoContainer) {
        videoContainer.style.pointerEvents = 'none';
    }
    if (!videoEl || typeof gsap === 'undefined') return;

    gsap.killTweensOf(videoEl);
    if (isEnabled) {
        lockContactVideoComposition();
        gsap.set(videoEl, {
            opacity: 1,
            filter: CONTACT_VIDEO_BASE_FILTER
        });
    } else if (resetTransform) {
        gsap.set(videoEl, { x: 0, y: '0vh', scale: isMobile ? getMobileUniformCinematicScale() : 1, clearProps: 'filter' });
        videoEl.style.objectPosition = '';
    } else {
        gsap.set(videoEl, { clearProps: 'filter' });
        videoEl.style.objectPosition = '';
    }
}

function updateCursor() {
    if (!CUSTOM_CURSOR_ENABLED || !cursorDot || !cursorRing) return;
    // Smoother movement for the ring (lerp)
    const lerpAmount = 0.15;
    ringX += (mouseX_raw - ringX) * lerpAmount;
    ringY += (mouseY_raw - ringY) * lerpAmount;

    cursorDot.style.left = mouseX_raw + 'px';
    cursorDot.style.top = mouseY_raw + 'px';
    
    cursorRing.style.left = ringX + 'px';
    cursorRing.style.top = ringY + 'px';

    requestAnimationFrame(updateCursor);
}
if (CUSTOM_CURSOR_ENABLED) {
    updateCursor();
}

const centerGlow = document.getElementById('center-glow');

// Initialise glow at screen center using GSAP transforms (avoids % â†’ px unit conflict)
if (centerGlow) {
    gsap.set(centerGlow, {
        xPercent: -50,
        yPercent: -50,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
    });
}

function applyAmbientPointerResponse(clientX, clientY) {
    if (isMobile || !videoEl) return;

    const normalizedX = (clientX / window.innerWidth - 0.5) * 2;
    const normalizedY = (clientY / window.innerHeight - 0.5) * 2;

    if (HOME_VIDEO_POINTER_PARALLAX_ENABLED && !isAnimating && !isRoutingThroughHome && HOME_EQUILIBRIUM_STATES.has(state) && document.body.classList.contains('hero-nav-ready')) {
        gsap.to(videoEl, {
            x: normalizedX * 5,
            y: normalizedY * 3,
            duration: 1.55,
            ease: "sine.out",
            overwrite: "auto"
        });
    }

	    if (!isAnimating && state === 'contact') {
	        videoEl.style.objectPosition = getContactVideoObjectPosition();
	
	        const clampedX = Math.max(-1, Math.min(1, normalizedX));
	        const clampedY = Math.max(-1, Math.min(1, normalizedY));
	        const proximity = Math.max(0, 1 - Math.hypot(normalizedX, normalizedY) / 1.42);
	        gsap.to(videoEl, {
	            x: clampedX * 5,
	            y: clampedY * 3,
	            scale: 1 + proximity * 0.006,
	            filter: `brightness(${1.055 + proximity * 0.018}) contrast(1.035) saturate(${1.02 + proximity * 0.018})`,
	            duration: 1.2,
	            ease: "sine.out",
	            overwrite: "auto"
	        });
	
	        gsap.to('.contact-plum-glow', {
            "--contact-glow-x": `${12 + clampedX * 1.6}%`,
            "--contact-glow-y": `${84 + clampedY * 1.1}%`,
            "--contact-cyan-x": `${78 + clampedX * 1.4}%`,
            "--contact-cyan-y": `${52 + clampedY * 0.9}%`,
            opacity: 0.42 + proximity * 0.07,
            scale: 1.035 + proximity * 0.006,
            duration: 0.95,
            ease: "sine.out",
            overwrite: "auto"
        });
        gsap.to('.contact-deep-fade', {
            opacity: 0.86 + proximity * 0.06,
            duration: 0.95,
            ease: "sine.out",
            overwrite: "auto"
        });
        gsap.to('.contact-cta', {
            textShadow: `0 0 ${5 + proximity * 7}px rgba(73, 217, 238, ${0.08 + proximity * 0.12})`,
            duration: 1.25,
            ease: "sine.out",
            overwrite: "auto"
        });
    }

}

function scheduleAmbientPointerResponse(clientX, clientY) {
    pendingAmbientPointer = { clientX, clientY };
    if (ambientPointerFrame) return;

    ambientPointerFrame = requestAnimationFrame(() => {
        ambientPointerFrame = null;
        const pointer = pendingAmbientPointer;
        pendingAmbientPointer = null;
        if (!pointer) return;
        applyAmbientPointerResponse(pointer.clientX, pointer.clientY);
    });
}

window.addEventListener('mousemove', (e) => {
    mouseX_raw = e.clientX;
    mouseY_raw = e.clientY;

    // Update mouse glows if exists
    if (CURSOR_GLOW_ENABLED && mouseGlow) {
        gsap.to(mouseGlow, {
            left: e.clientX,
            top: e.clientY,
            duration: 0.4,
            ease: "power2.out"
        });
    }

    // Background gradient follows cursor with a soft, organic lag
    if (centerGlow) {
        gsap.to(centerGlow, {
            x: e.clientX,
            y: e.clientY,
            duration: 1.4,
            ease: "power2.out",
            overwrite: "auto"
        });
    }

    // Parallax values for logo or other elements
    mouseX = (e.clientX - window.innerWidth / 2) / 200;
    mouseY = (e.clientY - window.innerHeight / 2) / 200;
    scheduleAmbientPointerResponse(e.clientX, e.clientY);
});

// Interactive hover effects for cursor
function initCursorHover() {
    if (!CUSTOM_CURSOR_ENABLED) return;
    const hoverTargets = document.querySelectorAll('a, button, .hover-target, .portfolio-item, .member');
    hoverTargets.forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
}
initCursorHover();


function isVertical() {
    return window.innerHeight > window.innerWidth;
}

/**
 * Pure Static Asset Pathing
 * Use relative paths starting with ./ so it works via file:// and local servers
 */
function getVideoSrc(pageId, isReverse = false) {
    const orientation = isMobile ? 'vertical' : (window.innerWidth > window.innerHeight ? 'horizontal' : 'vertical');
    
    if (pageId === 'intro') {
        return './videos/intro.mp4';
    }
    
    if (pageId === 'about') {
        const ext = (orientation === 'horizontal' && !isReverse) ? 'webm' : 'mp4';
        return `./videos/about ${orientation}${isReverse ? ' reverse' : ''}.${ext}`;
    }

    if (pageId === 'portfolios') {
        return '';
    }

    if (pageId === 'services') {
        if (isReverse) {
            if (isMobile) {
                return './videos/vertical utility home reverse mobile.mp4';
            }
            return `./videos/${orientation} utility home reverse.mp4`;
        }
        return ''; // Services uses its own dedicated video element for forward
    }

    if (pageId === 'blogs') {
        return '';
    }
    if (pageId === 'contact') {
        if (isReverse && orientation === 'horizontal') {
            return `./videos/contact horizontal reverse.mp4`;
        }
        const ext = (orientation === 'horizontal') ? 'webm' : 'mp4';
        return `./videos/contact ${orientation}${isReverse ? ' reverse' : ''}.${ext}`;
    }
    
    return `./videos/${orientation} utility${isReverse ? ' reverse' : ''}.mp4`;
}

function hasCinematicForwardVideo(pageId) {
    if (pageId === 'services') return true;
    return Boolean(getVideoSrc(pageId, false));
}

function removeManagedVideoListenerFrom(video, type, key) {
    if (!video || !video[key]) return;
    video.removeEventListener(type, video[key]);
    video[key] = null;
}

function removeManagedVideoListener(type, key) {
    removeManagedVideoListenerFrom(videoEl, type, key);
}

function addManagedVideoListener(type, key, handler, once = false) {
    removeManagedVideoListener(type, key);

    const wrappedHandler = (event) => {
        if (once) removeManagedVideoListener(type, key);
        handler(event);
    };

    videoEl[key] = wrappedHandler;
    videoEl.addEventListener(type, wrappedHandler);
}

function clearTransientVideoState() {
    if (pendingVideoTimeout) {
        clearTimeout(pendingVideoTimeout);
        pendingVideoTimeout = null;
    }

    removeManagedVideoListenerFrom(videoEl, 'ended', '_managedEndedHandler');
    removeManagedVideoListenerFrom(videoEl, 'playing', '_managedPlayingHandler');
    removeManagedVideoListenerFrom(videoEl, 'timeupdate', '_managedTimeupdateHandler');
}

function clearServicesPlaybackHandlers({ pause = false } = {}) {
    const servicesVideos = [
        document.getElementById('services-bg-video'),
        document.getElementById('services-loop-video')
    ].filter(Boolean);

    servicesVideos.forEach((video) => {
        if (video._checkTime) {
            video.removeEventListener('timeupdate', video._checkTime);
            video._checkTime = null;
        }
        if (video._startAmbientLoop) {
            video.removeEventListener('ended', video._startAmbientLoop);
            video._startAmbientLoop = null;
        }
        if (pause) {
            try { video.pause(); } catch (_) {}
        }
    });
}

function clearSectionTransitionTweens(pageId) {
    const targetMap = {
        about: ['.about-content', '.reveal-text'],
        services: ['#services-bg-video', '#services-loop-video', '.services-text-overlay', '.services-gradient-overlay'],
        portfolios: ['.portfolio-item'],
        blogs: ['#blogs-section .blogs-container h1', '#blogs-section .blog-card', '#blogs-section .blog-social-icons'],
        contact: ['.contact-plum-glow', '.contact-reveal', '.contact-social-link', '.contact-cta']
    };
    const targets = (targetMap[pageId] || []).flatMap(selector => gsap.utils.toArray(selector));
    if (targets.length) gsap.killTweensOf(targets);
    if (pageId === 'services') clearServicesPlaybackHandlers();
}

function clearTransitionBoundaryState(outgoingPageId) {
    clearTransientVideoState();
    gsap.killTweensOf([videoEl, handoffVideoBuffer].filter(Boolean));
    clearSectionTransitionTweens(outgoingPageId);

}

function getVideoObjectFit(src) {
    if (!isMobile) return 'cover';
    return 'contain';
}

function getVideoObjectPosition(src) {
    const videoSrc = decodeURIComponent(String(src || '').toLowerCase());
    if (!isMobile && videoSrc.includes('videos/contact ')) {
        return getContactVideoObjectPosition();
    }

    return 'center center';
}

function getHandoffVideoBuffer() {
    if (handoffVideoBuffer && document.body.contains(handoffVideoBuffer)) {
        return handoffVideoBuffer;
    }

    handoffVideoBuffer = document.createElement('video');
    handoffVideoBuffer.id = 'handoff-video-buffer';
    handoffVideoBuffer.muted = true;
    handoffVideoBuffer.playsInline = true;
    handoffVideoBuffer.preload = 'auto';
    handoffVideoBuffer.setAttribute('playsinline', '');
    handoffVideoBuffer.style.position = 'absolute';
    handoffVideoBuffer.style.inset = '0';
    handoffVideoBuffer.style.width = '100%';
    handoffVideoBuffer.style.height = '100%';
    handoffVideoBuffer.style.opacity = '0';
    handoffVideoBuffer.style.objectFit = 'cover';
    handoffVideoBuffer.style.objectPosition = 'center center';
    handoffVideoBuffer.style.backgroundColor = 'transparent';
    handoffVideoBuffer.style.mixBlendMode = 'screen';
    handoffVideoBuffer.style.transformOrigin = '50% 50%';
    handoffVideoBuffer.style.backfaceVisibility = 'hidden';
    handoffVideoBuffer.style.willChange = 'opacity, transform, filter';

    if (videoContainer) {
        videoContainer.appendChild(handoffVideoBuffer);
    }

    return handoffVideoBuffer;
}

function normalizeVideoSrc(src) {
    if (!src) return '';
    try {
        return new URL(src, window.location.href).href;
    } catch(e) {
        return src;
    }
}

function videoUsesSource(video, src) {
    if (!video || !src) return false;
    const expectedSrc = normalizeVideoSrc(src);
    return video.currentSrc === expectedSrc || video.src === expectedSrc;
}

function applyVideoPresentation(video, src, transformState = {}) {
    if (!video) return;

    // Shared presentation setup for the visible video and the hidden handoff buffer.
    // transformState.scale changes size; x/y move the frame; opacity controls visibility.
    gsap.killTweensOf(video);
    video.style.objectFit = getVideoObjectFit(src);
    video.style.objectPosition = getVideoObjectPosition(src);
    video.loop = false;
    video.muted = true;
    video.playsInline = true;

    gsap.set(video, {
        opacity: transformState.opacity ?? 0,
        scale: transformState.scale ?? gsap.getProperty(videoEl, 'scale') ?? 1,
        x: transformState.x ?? gsap.getProperty(videoEl, 'x') ?? 0,
        y: transformState.y ?? gsap.getProperty(videoEl, 'y') ?? 0,
        filter: transformState.filter ?? 'none',
        clearProps: transformState.clearProps || ''
    });
}

function primeBufferedHandoffVideo(src, transformState = {}, startTime = 0, options = {}) {
    // Preloads a video into the hidden handoff buffer before it becomes visible.
    // startTime lets you skip part of a clip; keep it at 0 for the full intro.
    if (!src || (isMobile && !options.allowMobile) || !videoContainer) return;

    const bufferVideo = getHandoffVideoBuffer();
    const handoffStartTime = Math.max(0, Number(startTime) || 0);
    applyVideoPresentation(bufferVideo, src, {
        opacity: 0,
        scale: transformState.scale,
        x: transformState.x,
        y: transformState.y,
        filter: 'none'
    });

    const isSameSource = videoUsesSource(bufferVideo, src);
    if (!isSameSource) {
        bufferVideo.src = src;
        bufferVideo.load();
    }

    if (!isSameSource || Math.abs((bufferVideo.currentTime || 0) - handoffStartTime) > 0.035) {
        try {
            bufferVideo.currentTime = handoffStartTime;
        } catch(e) {}
    }
}

function primeDesktopHomeDirectContactHandoff() {
    if (isMobile || isAnimating || !HOME_EQUILIBRIUM_STATES.has(state)) return;

    requestAnimationFrame(() => {
        if (isMobile || isAnimating || !HOME_EQUILIBRIUM_STATES.has(state)) return;
        primeBufferedHandoffVideo(getDesktopHomeDirectVideoSrc('contact'), {
            scale: getVisibleHomeSourceScale(),
            x: 0,
            y: '0vh'
        }, 0);
    });
}

function waitForFirstDecodedFrame(video, callback, immediateIfReady = false) {
    let hasCommitted = false;
    const commit = () => {
        if (hasCommitted) return;
        hasCommitted = true;
        callback();
    };
    const commitAfterFrame = () => requestAnimationFrame(commit);

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        if (immediateIfReady) {
            commit();
        } else {
            commitAfterFrame();
        }
    }

    if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(commit);
    }

    video.addEventListener('seeked', commitAfterFrame, { once: true });
    video.addEventListener('loadeddata', commitAfterFrame, { once: true });
    video.addEventListener('canplay', commitAfterFrame, { once: true });
    setTimeout(() => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            commitAfterFrame();
        }
    }, 360);
    setTimeout(commit, 900);
}

function getRuntimeHomeEquilibriumSrc() {
    return getVideoSrc('intro');
}

function getRuntimeHomeEquilibriumTransform() {
    return {
        scale: isMobile ? getHomeLogoDisplayScale() : DESKTOP_HOME_INTRO_REFERENCE_SCALE,
        x: 0,
        y: '0vh'
    };
}


function waitForVideoFrameCommit(video, callback, immediateIfReady = true) {
    let hasCommitted = false;
    const commit = () => {
        if (hasCommitted) return;
        hasCommitted = true;
        callback();
    };

    const commitOnFrame = () => {
        if (hasCommitted) return;
        if (typeof video.requestVideoFrameCallback === 'function') {
            video.requestVideoFrameCallback(commit);
        } else {
            requestAnimationFrame(commit);
        }
    };

    if (immediateIfReady && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        requestAnimationFrame(commitOnFrame);
    }

    video.addEventListener('seeked', () => requestAnimationFrame(commitOnFrame), { once: true });
    video.addEventListener('loadeddata', () => requestAnimationFrame(commitOnFrame), { once: true });
    video.addEventListener('canplay', () => requestAnimationFrame(commitOnFrame), { once: true });
    setTimeout(commit, 320);
}

function prepareRuntimeHomeEquilibriumFrame(onReady = null) {
    if (isMobile || !videoContainer) {
        if (typeof onReady === 'function') onReady(null);
        return null;
    }

    const src = getRuntimeHomeEquilibriumSrc();
    if (!src) {
        if (typeof onReady === 'function') onReady(null);
        return null;
    }

    const bufferVideo = getHandoffVideoBuffer();
    const homeTransform = getRuntimeHomeEquilibriumTransform();
    applyVideoPresentation(bufferVideo, src, {
        opacity: 0,
        scale: homeTransform.scale,
        x: homeTransform.x,
        y: homeTransform.y,
        filter: 'none'
    });
    bufferVideo.pause();

    const isSameSource = videoUsesSource(bufferVideo, src);
    if (!isSameSource) {
        bufferVideo._runtimeHomeEquilibriumReady = false;
        bufferVideo.src = src;
        bufferVideo.load();
    }

    let hasPrepared = false;
    let hasStartedSeek = false;
    const finishPreparation = () => {
        if (hasPrepared) return;
        hasPrepared = true;
        bufferVideo._runtimeHomeEquilibriumReady = true;
        bufferVideo._runtimeHomeEquilibriumSrc = normalizeVideoSrc(src);
        if (typeof onReady === 'function') onReady(bufferVideo);
    };

    const seekToHomeFrame = () => {
        if (hasStartedSeek) return;
        hasStartedSeek = true;

        if (!bufferVideo.duration || !Number.isFinite(bufferVideo.duration)) {
            waitForVideoFrameCommit(bufferVideo, finishPreparation);
            return;
        }

        const targetTime = Math.max(0, bufferVideo.duration - HOME_EQUILIBRIUM_FRAME_LEAD);
        if (
            bufferVideo._runtimeHomeEquilibriumReady &&
            bufferVideo._runtimeHomeEquilibriumSrc === normalizeVideoSrc(src) &&
            Math.abs(bufferVideo.currentTime - targetTime) < 0.12
        ) {
            finishPreparation();
            return;
        }

        waitForVideoFrameCommit(bufferVideo, finishPreparation, false);
        try {
            bufferVideo.currentTime = targetTime;
        } catch(e) {
            finishPreparation();
        }
    };

    if (bufferVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
        seekToHomeFrame();
    } else {
        const metadataFallback = setTimeout(seekToHomeFrame, 900);
        const handleMetadataReady = () => {
            clearTimeout(metadataFallback);
            seekToHomeFrame();
        };
        bufferVideo.addEventListener('loadedmetadata', handleMetadataReady, { once: true });
        bufferVideo.addEventListener('canplay', handleMetadataReady, { once: true });
    }

    return bufferVideo;
}

function commitRuntimeHomeEquilibriumFrame(onComplete, options = {}) {
    const {
        crossfade = false,
        smoothScale = false,
        smoothScaleDuration = MOBILE_INTRO_HOME_SETTLE_SCALE_DURATION
    } = options;
    const homeTransform = getRuntimeHomeEquilibriumTransform();

    const completeAfterNormalize = () => {
        requestAnimationFrame(() => {
            if (typeof onComplete === 'function') onComplete();
        });
    };

    const normalizeAndComplete = () => {
        if (smoothScale && isMobile && typeof gsap !== 'undefined' && videoEl) {
            gsap.killTweensOf(videoEl);
            videoEl.playbackRate = 1;
            videoEl.style.objectPosition = 'center center';
            gsap.set(videoEl, {
                opacity: 1,
                x: homeTransform.x,
                y: homeTransform.y,
                transformOrigin: '50% 50%',
                clearProps: 'filter'
            });
            gsap.to(videoEl, {
                scale: homeTransform.scale,
                duration: smoothScaleDuration,
                ease: 'sine.inOut',
                overwrite: 'auto',
                onComplete: () => {
                    normalizePrimaryVideoState({
                        opacity: 1,
                        scale: homeTransform.scale,
                        x: homeTransform.x,
                        y: homeTransform.y,
                        objectPosition: 'center center',
                        playbackRate: 1
                    });
                    completeAfterNormalize();
                }
            });
            return;
        }

        normalizePrimaryVideoState({
            opacity: 1,
            scale: homeTransform.scale,
            x: homeTransform.x,
            y: homeTransform.y,
            objectPosition: 'center center',
            playbackRate: 1
        });
        completeAfterNormalize();
    };

    if (isMobile || !videoContainer) {
        normalizeAndComplete();
        return;
    }

    const src = getRuntimeHomeEquilibriumSrc();
    if (!src) {
        normalizeAndComplete();
        return;
    }

    if (videoUsesSource(videoEl, src)) {
        normalizeAndComplete();
        return;
    }

    prepareRuntimeHomeEquilibriumFrame((bufferVideo) => {
        if (
            !bufferVideo ||
            !videoUsesSource(bufferVideo, src) ||
            bufferVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
            const finishForcedHomeFrame = () => {
                videoEl.pause();
                videoEl.style.objectFit = getVideoObjectFit(src);
                videoEl.style.objectPosition = getVideoObjectPosition(src);
                normalizeAndComplete();
            };
            applyVideoPresentation(videoEl, src, {
                opacity: 1,
                scale: homeTransform.scale,
                x: homeTransform.x,
                y: homeTransform.y,
                filter: 'none'
            });
            if (!videoUsesSource(videoEl, src)) {
                videoEl.src = src;
                videoEl.load();
            }
            const seekForcedHomeFrame = () => {
                const duration = videoEl.duration;
                if (!Number.isFinite(duration) || duration <= 0) {
                    finishForcedHomeFrame();
                    return;
                }
                let hasFinished = false;
                const finishOnce = () => {
                    if (hasFinished) return;
                    hasFinished = true;
                    requestAnimationFrame(finishForcedHomeFrame);
                };
                videoEl.addEventListener('seeked', finishOnce, { once: true });
                setTimeout(finishOnce, 500);
                try {
                    videoEl.currentTime = Math.max(0, duration - HOME_EQUILIBRIUM_FRAME_LEAD);
                } catch(e) {
                    finishOnce();
                }
            };
            if (videoEl.readyState >= HTMLMediaElement.HAVE_METADATA) {
                seekForcedHomeFrame();
            } else {
                videoEl.addEventListener('loadedmetadata', seekForcedHomeFrame, { once: true });
                videoEl.addEventListener('canplay', seekForcedHomeFrame, { once: true });
                setTimeout(seekForcedHomeFrame, 900);
            }
            return;
        }

        bufferVideo.pause();

        if (crossfade && !isMobile) {
            const outgoingVideo = videoEl;
            gsap.set(bufferVideo, {
                opacity: 0,
                scale: homeTransform.scale,
                x: homeTransform.x,
                y: homeTransform.y,
                clearProps: 'filter'
            });
            gsap.set(outgoingVideo, { opacity: 1, clearProps: 'filter' });
            gsap.to(outgoingVideo, {
                scale: homeTransform.scale,
                x: homeTransform.x,
                y: homeTransform.y,
                duration: INTRO_HOME_SETTLE_SCALE_DURATION,
                ease: "sine.inOut",
                overwrite: 'auto',
                onComplete: () => {
                    freezeInlineVideo(outgoingVideo, 0.02);
                    normalizePrimaryVideoState({
                        opacity: 1,
                        scale: homeTransform.scale,
                        x: homeTransform.x,
                        y: homeTransform.y,
                        objectPosition: 'center center',
                        playbackRate: 1
                    });
                    requestAnimationFrame(() => {
                        if (typeof onComplete === 'function') onComplete();
                    });
                }
            });
            return;
        }

        activateBufferedVideo(bufferVideo);
        videoEl.pause();
        videoEl.style.objectFit = getVideoObjectFit(src);
        videoEl.style.objectPosition = getVideoObjectPosition(src);
        requestAnimationFrame(normalizeAndComplete);
    });
}

function activateBufferedVideo(bufferVideo, options = {}) {
    // Swaps the hidden buffer into #bg-video. This is the main stitch/crossfade point.
    // VIDEO_HANDOFF_FADE_DURATION and VIDEO_HANDOFF_IN_FADE_DURATION control speed.
    const outgoingVideo = videoEl;
    if (!bufferVideo || bufferVideo === outgoingVideo) return outgoingVideo;
    const instantReveal = Boolean(options.instantReveal);

    gsap.killTweensOf([outgoingVideo, bufferVideo]);
    const computedOutgoingOpacity = Number(getComputedStyle(outgoingVideo).opacity);
    const outgoingOpacity = Number.isFinite(computedOutgoingOpacity)
        ? computedOutgoingOpacity
        : (Number(gsap.getProperty(outgoingVideo, 'opacity')) || 0);
    const shouldCrossfade = !instantReveal && outgoingOpacity > 0.05 && (!isMobile || options.mobileCrossfade);
    outgoingVideo.id = 'handoff-video-buffer';
    bufferVideo.id = 'bg-video';
    videoEl = bufferVideo;
    handoffVideoBuffer = outgoingVideo;

    if (instantReveal) {
        gsap.set(bufferVideo, { opacity: 1, clearProps: 'filter' });
        gsap.set(outgoingVideo, { opacity: 0, clearProps: 'filter' });
        outgoingVideo.pause();
    } else if (shouldCrossfade) {
        gsap.set(bufferVideo, { opacity: VIDEO_HANDOFF_IN_START_OPACITY, clearProps: 'filter' });
        gsap.set(outgoingVideo, { opacity: Math.min(outgoingOpacity, 1), clearProps: 'filter' });
        gsap.timeline({
            defaults: {
                ease: 'sine.inOut',
                overwrite: true
            },
            onComplete: () => outgoingVideo.pause()
        })
            .to(bufferVideo, {
                opacity: 1,
                duration: VIDEO_HANDOFF_IN_FADE_DURATION
            }, 0)
            .to(outgoingVideo, {
                opacity: 0,
                duration: VIDEO_HANDOFF_FADE_DURATION
            }, 0);
    } else {
        gsap.set(bufferVideo, { opacity: 1, clearProps: 'filter' });
        gsap.set(outgoingVideo, { opacity: 0, clearProps: 'filter' });
        outgoingVideo.pause();
    }

    return bufferVideo;
}

function playVideo(src, onComplete, seamless = false, shouldLoop = false, playbackRate = 1.0, completionLead = 0.08, handoffOptions = {}) {
    // Generic video transition runner.
    // playbackRate controls clip speed; completionLead controls how early onComplete fires.
    // handoffOptions.startTime/endTransform are where size, movement, and stitch timing enter.
    const transitionToken = ++videoTransitionToken;
    clearTransientVideoState();
    const isReverseTransition = Boolean(src && src.includes('reverse'));
    const shouldApplyHandoffBlur = !seamless || isReverseTransition || handoffOptions.buffered;
    const handoffBlur = isReverseTransition ? 'blur(2.5px)' : 'blur(1.5px)';
    const handoffBlurDuration = isReverseTransition ? 0.5 : 0.36;
    const shouldUseBufferedHandoff = Boolean(
        handoffOptions.buffered
        && seamless
        && !shouldLoop
        && videoContainer
        && (!isMobile || handoffOptions.allowMobileBuffered)
    );

    if (!src) {
        if (seamless) {
            pendingVideoTimeout = setTimeout(() => {
                pendingVideoTimeout = null;
                if (transitionToken !== videoTransitionToken) return;
                if (isMobile) {
                    leaveMobileHomeState();
                }
                gsap.set(videoEl, { clearProps: 'filter' });
                if (onComplete) onComplete();
            }, handoffOptions.noVideoDelay ?? 70);
            return;
        }

        if (state === 'blogs') {
            // Blogs has custom zoom handled outside
        } else {
            gsap.to(videoEl, { opacity: 0, filter: 'blur(1.5px)', duration: 0.22, ease: 'sine.inOut', overwrite: 'auto' });
        }
        const noVideoDelay = state === 'blogs' ? 0 : 500;
        pendingVideoTimeout = setTimeout(() => {
            pendingVideoTimeout = null;
            if (transitionToken !== videoTransitionToken) return;
            videoEl.pause();
            gsap.set(videoEl, { clearProps: 'filter' });
            if (onComplete) onComplete();
        }, noVideoDelay);
        return;
    }

    const startPlayback = () => {
        if (transitionToken !== videoTransitionToken) return;

        const playbackVideo = shouldUseBufferedHandoff ? getHandoffVideoBuffer() : videoEl;
        const outgoingVideo = videoEl;
        const isSameSource = videoUsesSource(playbackVideo, src);
        const startTransform = handoffOptions.startTransform || {};
        const startTime = Math.max(0, Number(handoffOptions.startTime) || 0);

        if (shouldUseBufferedHandoff) {
            applyVideoPresentation(playbackVideo, src, {
                opacity: 0,
                scale: startTransform.scale,
                x: startTransform.x,
                y: startTransform.y,
                filter: 'none'
            });
        }

        if (!isSameSource) {
            playbackVideo.src = src;
        }
        playbackVideo.style.objectFit = getVideoObjectFit(src);
        playbackVideo.style.objectPosition = getVideoObjectPosition(src);
        if (!isSameSource) {
            playbackVideo.load();
        }
        playbackVideo.loop = shouldLoop;
        playbackVideo.playbackRate = playbackRate;
        const shouldResetPlaybackTime = !shouldUseBufferedHandoff
            || !isSameSource
            || playbackVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
            || Math.abs((playbackVideo.currentTime || 0) - startTime) > 0.035;
        if (shouldResetPlaybackTime) {
            try {
                playbackVideo.currentTime = startTime;
            } catch(e) {}
        }
        
        let playPromise = null;
        const ensurePlaybackStarted = () => {
            if (playPromise !== null) return playPromise;
            playPromise = playbackVideo.play();
            if (playPromise !== undefined && typeof playPromise.catch === 'function') {
                playPromise.catch(error => {
                    console.log("Auto-play was prevented", error);
                    if (transitionToken === videoTransitionToken) {
                        gsap.set(videoEl, { clearProps: 'filter' });
                    }
                });
            }
            return playPromise;
        };
        const releaseVideo = () => {
            if (transitionToken !== videoTransitionToken) return;
            videoEl.playbackRate = playbackRate;
            if (seamless && isMobile) {
                leaveMobileHomeState();
            }
            if (typeof handoffOptions.beforeReveal === 'function') {
                handoffOptions.beforeReveal();
            }

            if (seamless && !shouldUseBufferedHandoff) {
                const revealOpacity = handoffOptions.revealOpacity ?? 1;
                const currentOpacity = Number(gsap.getProperty(videoEl, 'opacity'));
                if (isMobile && !isReverseTransition && revealOpacity > currentOpacity) {
                    gsap.to(videoEl, {
                        opacity: revealOpacity,
                        duration: SECTION_MEDIA_FADE_IN_DURATION,
                        ease: 'sine.out',
                        overwrite: 'auto'
                    });
                } else {
                    gsap.set(videoEl, { opacity: revealOpacity });
                }
            }

            if (shouldApplyHandoffBlur) {
                gsap.to(videoEl, {
                    filter: 'blur(0px)',
                    duration: handoffBlurDuration,
                    ease: 'sine.out',
                    overwrite: 'auto',
                    onComplete: () => {
                        if (transitionToken === videoTransitionToken) {
                            gsap.set(videoEl, { clearProps: 'filter' });
                        }
                    }
                });
            } else {
                gsap.set(videoEl, { clearProps: 'filter' });
            }

            if (!seamless) {
                gsap.to(videoEl, {
                    opacity: 1,
                    duration: isReverseTransition ? 0.32 : 0.34,
                    ease: 'sine.out',
                    overwrite: 'auto'
                });
            }

            installCompletionHandlers();
        };

        const animateBufferedTransform = () => {
            if (!handoffOptions.endTransform) return;
            const transformDuration = handoffOptions.endTransform.duration ?? 0.54;
            let transformDelay = handoffOptions.endTransform.delay ?? 0;
            if (handoffOptions.endTransform.alignToEnd) {
                const mediaDuration = Number(videoEl.duration);
                const mediaCurrentTime = Number(videoEl.currentTime) || 0;
                const mediaRate = Math.max(0.01, Math.abs(videoEl.playbackRate || playbackRate || 1));
                const lead = handoffOptions.endTransform.lead ?? 0;
                if (Number.isFinite(mediaDuration) && mediaDuration > 0) {
                    const remainingMediaDuration = Math.max(0, mediaDuration - mediaCurrentTime);
                    transformDelay = Math.max(0, (remainingMediaDuration / mediaRate) - transformDuration - lead);
                }
            }
            gsap.to(videoEl, {
                scale: handoffOptions.endTransform.scale ?? 1,
                x: handoffOptions.endTransform.x ?? 0,
                y: handoffOptions.endTransform.y ?? 0,
                duration: transformDuration,
                delay: transformDelay,
                ease: handoffOptions.endTransform.ease || 'power2.inOut',
                overwrite: 'auto'
            });
        };

        const installCompletionHandlers = () => {
            if (shouldLoop) {
                // If looping, we call onComplete immediately after it starts playing
                if (transitionToken === videoTransitionToken && onComplete) onComplete();
                return;
            }

            let hasCompleted = false;
            const completePlayback = () => {
                if (transitionToken !== videoTransitionToken) return;
                if (hasCompleted) return;
                hasCompleted = true;
                if (onComplete) onComplete();
                videoEl.playbackRate = 1.0; // Reset speed after transition
            };

            addManagedVideoListener('ended', '_managedEndedHandler', completePlayback, true);
            addManagedVideoListener('timeupdate', '_managedTimeupdateHandler', () => {
                if (!videoEl.duration) return;
                if (completionLead > 0 && videoEl.currentTime >= videoEl.duration - completionLead) {
                    completePlayback();
                }
            });
        };

        let hasCommittedPlayback = false;
        const commitPlayback = () => {
            if (transitionToken !== videoTransitionToken) return;
            if (hasCommittedPlayback) return;
            hasCommittedPlayback = true;
            if (shouldUseBufferedHandoff) {
                activateBufferedVideo(playbackVideo, {
                    instantReveal: handoffOptions.instantReveal,
                    mobileCrossfade: handoffOptions.mobileCrossfade
                });
            }
            animateBufferedTransform();
            releaseVideo();
        };

        if (shouldUseBufferedHandoff) {
            const canCommitBeforePlay = isSameSource
                && !shouldResetPlaybackTime
                && playbackVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

            if (canCommitBeforePlay) {
                waitForFirstDecodedFrame(playbackVideo, () => {
                    commitPlayback();
                    ensurePlaybackStarted();
                }, true);
            } else {
                ensurePlaybackStarted();
                waitForFirstDecodedFrame(playbackVideo, commitPlayback);
            }
            setTimeout(commitPlayback, 720);
        } else if (ensurePlaybackStarted() !== undefined) {
            playPromise.then(() => {
                commitPlayback();
            });
            setTimeout(commitPlayback, 720);
        } else {
            commitPlayback();
        }
    };

    if (seamless) {
        const initialOpacity = handoffOptions.initialOpacity ?? (isMobile && !isReverseTransition && !shouldUseBufferedHandoff ? 0 : 1);
        const initialState = { opacity: initialOpacity };
        if (shouldApplyHandoffBlur) {
            initialState.filter = handoffBlur;
        } else {
            initialState.clearProps = 'filter';
        }
        const currentOpacity = Number(gsap.getProperty(videoEl, 'opacity'));
        const beginPlayback = () => {
            gsap.set(videoEl, initialState);
            startPlayback();
        };
        if (isMobile && !isReverseTransition && currentOpacity > initialOpacity) {
            gsap.to(videoEl, {
                opacity: initialOpacity,
                ...(shouldApplyHandoffBlur ? { filter: handoffBlur } : {}),
                duration: SECTION_MEDIA_FADE_OUT_DURATION,
                ease: 'sine.inOut',
                overwrite: 'auto',
                onComplete: beginPlayback
            });
        } else {
            beginPlayback();
        }
    } else {
        gsap.to(videoEl, {
            opacity: 0,
            filter: handoffBlur,
            duration: isReverseTransition ? 0.26 : 0.2,
            ease: 'sine.inOut',
            overwrite: 'auto',
            onComplete: startPlayback
        });
    }
}


function hideMobileHamburger() {
    if (mobileHamburger) {
        mobileHamburger.classList.remove('visible');
    }
    if (mobileBrandHome) {
        mobileBrandHome.classList.remove('visible');
    }
}

function showMobileHamburger() {
    if (mobileHamburger) {
        mobileHamburger.classList.add('visible');
    }
    if (mobileBrandHome) {
        mobileBrandHome.classList.add('visible');
    }
}

function getMobileNavAnimationTargets() {
    const items = mobileNavOverlay
        ? Array.from(mobileNavOverlay.querySelectorAll('.mobile-nav-item'))
        : [];
    const closeButton = mobileNavOverlay
        ? mobileNavOverlay.querySelector('.mobile-nav-close')
        : null;

    return {
        items,
        closeButton,
        targets: [mobileNavOverlay, closeButton, ...items].filter(Boolean)
    };
}

function prepareMobileNavFade({ home = false } = {}) {
    if (!mobileNavOverlay || typeof gsap === 'undefined') return;

    const { items, closeButton, targets } = getMobileNavAnimationTargets();
    gsap.killTweensOf(targets);
    gsap.set(mobileNavOverlay, { opacity: 0, "--mobile-nav-gradient-opacity": 0 });
    gsap.set(items, { opacity: 0 });
    if (closeButton) {
        gsap.set(closeButton, { opacity: 0 });
    }
}

function fadeMobileNavIn({ home = false, delay = 0 } = {}) {
    if (!mobileNavOverlay || typeof gsap === 'undefined') return;

    const { items, closeButton, targets } = getMobileNavAnimationTargets();
    gsap.killTweensOf(targets);
    gsap.set(mobileNavOverlay, { opacity: 0, "--mobile-nav-gradient-opacity": 0 });
    gsap.set(items, { opacity: 0 });
    if (closeButton) {
        gsap.set(closeButton, { opacity: 0 });
    }

    requestAnimationFrame(() => {
        if (!document.body.classList.contains('show-mobile-nav')) return;

        const overlayDuration = home ? 1.38 : 0.72;
        const itemDuration = home ? 0.98 : 0.52;
        const targetGradientOpacity = home ? 0.92 : 0.92;
        const timeline = gsap.timeline({
            delay,
            defaults: { overwrite: true }
        });

        timeline.to(mobileNavOverlay, {
            opacity: 1,
            "--mobile-nav-gradient-opacity": targetGradientOpacity,
            duration: overlayDuration,
            ease: "sine.inOut",
            clearProps: "opacity"
        }, 0);
        timeline.to(items, {
            opacity: 1,
            duration: itemDuration,
            stagger: home ? 0.075 : 0.045,
            ease: "sine.out",
            clearProps: "opacity"
        }, home ? 0.24 : 0.12);

        if (closeButton && !home) {
            timeline.to(closeButton, {
                opacity: 1,
                duration: 0.42,
                ease: "sine.out",
                clearProps: "opacity"
            }, 0.16);
        }
    });
}

function fadeMobileNavOut(onComplete) {
    if (!mobileNavOverlay || !document.body.classList.contains('show-mobile-nav')) {
        if (onComplete) onComplete();
        return;
    }

    const finish = () => {
        document.body.classList.remove('show-mobile-nav', 'mobile-home-nav');
        if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'true');

        if (typeof gsap !== 'undefined') {
            const { items, closeButton } = getMobileNavAnimationTargets();
            gsap.set(mobileNavOverlay, { "--mobile-nav-gradient-opacity": 0, clearProps: "opacity" });
            gsap.set(items, { clearProps: "opacity" });
            if (closeButton) gsap.set(closeButton, { clearProps: "opacity" });
        }

        if (onComplete) onComplete();
    };

    if (typeof gsap === 'undefined') {
        finish();
        return;
    }

    const wasHome = document.body.classList.contains('mobile-home-nav');
    const { items, closeButton, targets } = getMobileNavAnimationTargets();
    gsap.killTweensOf(targets);
    const timeline = gsap.timeline({
        defaults: { overwrite: true },
        onComplete: finish
    });

    timeline.to(items, {
        opacity: 0,
        duration: wasHome ? 0.58 : 0.34,
        stagger: { each: wasHome ? 0.04 : 0.025, from: "end" },
        ease: "sine.inOut"
    }, 0);
    if (closeButton) {
        timeline.to(closeButton, { opacity: 0, duration: 0.28, ease: "sine.inOut" }, 0);
    }
    timeline.to(mobileNavOverlay, {
        opacity: 0,
        "--mobile-nav-gradient-opacity": 0,
        duration: wasHome ? 0.95 : 0.58,
        ease: "sine.inOut"
    }, wasHome ? 0.08 : 0.04);
}

function clearMobileIntroFallback() {
    if (mobileIntroFallbackTimeout) {
        clearTimeout(mobileIntroFallbackTimeout);
        mobileIntroFallbackTimeout = null;
    }
}

function freezeInlineVideo(video, offset = 0.06) {
    if (!video) return;

    const duration = video.duration;
    if (Number.isFinite(duration) && duration > 0) {
        const freezeTime = Math.max(0, duration - offset);
        try {
            video.currentTime = freezeTime;
        } catch (_) {
            // Ignore browsers that reject the seek and keep the current frame.
        }
    }

    video.pause();
}

function enterMobileHomeState(options = {}) {
    if (!isMobile) return;
    if (USE_DESKTOP_CINEMATIC_ON_MOBILE) {
        lockMobileComposition();
        const { showNavigation = true, settleScale = getHomeLogoDisplayScale() } = options;
        state = showNavigation ? 'mobile-nav' : 'stabilize';
        setHeroNavReady(showNavigation);
        prepareMobileNavFade({ home: true });
        document.body.classList.remove('intro-active');
        document.body.classList.add('mobile-home-nav');
        document.body.classList.toggle('show-mobile-nav', showNavigation);
        if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', showNavigation ? 'false' : 'true');
        gsap.set(videoEl, {
            opacity: 1,
            visibility: 'visible',
            scale: settleScale,
            x: 0,
            y: '0vh',
            objectPosition: 'center center',
            filter: 'brightness(0.78) contrast(1.08) saturate(1.02)'
        });
        if (showNavigation) {
            hideMobileHamburger();
            fadeMobileNavIn({ home: true, delay: 0.08 });
        } else {
            showMobileHamburger();
        }
        gsap.to(document.getElementById('status-label'), { opacity: 0, duration: 0.25 });
        scheduleBackgroundWarmup();
        return;
    }

    lockMobileComposition();

    const { showNavigation = true } = options;
    clearMobileIntroFallback();
    state = showNavigation ? 'mobile-nav' : 'stabilize';
    setHeroNavReady(showNavigation);
    prepareMobileNavFade({ home: true });
    document.body.classList.remove('intro-active');
    document.body.classList.add('mobile-home-nav');
    document.body.classList.toggle('show-mobile-nav', showNavigation);
    if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', showNavigation ? 'false' : 'true');
    if (showNavigation) {
        fadeMobileNavIn({ home: true, delay: 0.08 });
    } else if (mobileNavOverlay) {
        gsap.set(mobileNavOverlay, { opacity: 0, "--mobile-nav-gradient-opacity": 0 });
    }

    freezeInlineVideo(mobileIntroVideo);
    hideMobileHamburger();
    gsap.set(videoEl, { opacity: 0 });
    gsap.to(document.getElementById('status-label'), { opacity: 0, duration: 0.25 });
    scheduleBackgroundWarmup();
}

function leaveMobileHomeState() {
    if (isMobile) lockMobileComposition();
    document.body.classList.remove('show-mobile-nav', 'mobile-home-nav', 'intro-active');
    if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'true');
    prepareMobileNavFade({ home: false });
}

function startMobileIntro() {
    if (!isMobile) return;
    if (USE_DESKTOP_CINEMATIC_ON_MOBILE) {
        playIntro();
        return;
    }

    lockMobileComposition();

    clearMobileIntroFallback();
    state = 'mobile-landing';
    setHeroNavReady(!isMobile);
    document.body.classList.remove('show-mobile-nav', 'mobile-home-nav');
    document.body.classList.add('intro-active');
    if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'true');
    prepareMobileNavFade({ home: true });

    hideMobileHamburger();
    gsap.set(videoEl, { opacity: 0, scale: 1, y: '0vh' });
    gsap.to(document.getElementById('status-label'), { opacity: 0, duration: 0.2 });

    if (!mobileIntroVideo) {
        enterMobileHomeState();
        return;
    }

    let introCompleted = false;
    const finalizeIntro = () => {
        if (introCompleted || state !== 'mobile-landing') return;
        introCompleted = true;
        mobileIntroVideo.ontimeupdate = null;
        mobileIntroVideo.onended = null;
        freezeInlineVideo(mobileIntroVideo);
        enterMobileHomeState();
        isAnimating = false;
    };

    mobileIntroVideo.loop = false;
    mobileIntroVideo.currentTime = 0;
    mobileIntroVideo.playbackRate = INTRO_PLAYBACK_RATE;
    mobileIntroVideo.onended = finalizeIntro;
    mobileIntroVideo.ontimeupdate = () => {
        if (!mobileIntroVideo.duration) return;
        if (mobileIntroVideo.currentTime >= mobileIntroVideo.duration - 0.08) {
            finalizeIntro();
        }
    };

    const playAttempt = mobileIntroVideo.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {});
    }

    mobileIntroFallbackTimeout = setTimeout(finalizeIntro, 4500);
}

function playIntro() {
    if(isAnimating) return;
    isAnimating = true;
    clearTransientVideoState();
    setHeroNavReady(false);
    hideMobileHamburger();
    document.body.classList.remove('show-mobile-nav', 'mobile-home-nav', 'intro-active');
    if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'true');

    state = 'intro';

    const introStartScale = isMobile ? 1 : INTRO_ZOOM_START_SCALE;
    normalizePrimaryVideoState({
        opacity: 1,
        scale: introStartScale,
        x: 0,
        y: '0vh',
        objectPosition: 'center center',
        playbackRate: INTRO_PLAYBACK_RATE
    });
    prepareRuntimeHomeEquilibriumFrame();

    // Play intro video
    playVideo(getVideoSrc('intro'), () => {
        commitRuntimeHomeEquilibriumFrame(() => {
            state = 'stabilize';

            // Final UI reveal
            gsap.to('#center-nav', {
                opacity: 1,
                pointerEvents: 'auto',
                duration: 0.4,
                ease: "power2.out",
                onStart: () => setHeroNavReady(true)
            });

            gsap.to(document.getElementById('status-label'), { opacity: 1, duration: 0.67 });
            scheduleBackgroundWarmup();
            primeDesktopHomeDirectContactHandoff();
            if (isMobile) {
                enterMobileHomeState({ showNavigation: true });
            }

            isAnimating = false;
            runQueuedSectionTransition();
        }, { crossfade: !isMobile, smoothScale: isMobile });
    }, false, false, INTRO_PLAYBACK_RATE, isMobile ? 0.08 : INTRO_HOME_COMPLETION_LEAD);
}


function onMobileLandingTap(e) {
    if (state !== 'mobile-landing') return;
    if (e) e.preventDefault();
    isAnimating = true;
    freezeInlineVideo(mobileIntroVideo);
    enterMobileHomeState();
    isAnimating = false;
}

if (trigger) {
    trigger.addEventListener('touchstart', onMobileLandingTap, { passive: false });
    trigger.addEventListener('click', onMobileLandingTap);
}

// Start sequence when browser is ready
window.addEventListener('load', () => {
    // Slight delay to ensure CDN scripts (GSAP) and layout are fully parsed
    setTimeout(() => {
        if (isMobile) {
            startMobileIntro();
            return;
        }

        playIntro();
    }, 0);
});

function initNavSystems() {
    const navLinks = document.querySelectorAll('.nav-item, .nav-link');
    
    navLinks.forEach(link => {
        const warmTarget = () => {
            const targetId = link.getAttribute('data-target');
            if (!targetId || targetId === 'experience-trigger') return;

            const pageId = targetId.split('-')[0];
            warmTransitionForPage(pageId);
            warmPageResources(pageId);
            warmTransitionAudio(pageId);
        };

        link.addEventListener('mouseenter', warmTarget);
        link.addEventListener('focus', warmTarget);
        link.addEventListener('touchstart', warmTarget, { passive: true });
        if (link.tagName !== 'A') {
            link.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                link.click();
            });
        }

        link.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const targetId = link.getAttribute('data-target');
            
            if (targetId === 'experience-trigger') {
                window.location.reload(); 
                return;
            }
            
            const pageId = targetId.split('-')[0];
            startVideoTransition(pageId);
        });
    });
}
initNavSystems();

function startVideoTransition(pageId) {
    warmTransitionForPage(pageId);
    warmPageResources(pageId);

    setHeroNavReady(!isMobile);
    if (isMobile) {
        lockMobileComposition();
    }

    if (isMobile && document.body.classList.contains('show-mobile-nav')) {
        fadeMobileNavOut();
    }

    if (isBlogArticleOverlayOpen && pageId !== 'blogs') {
        window.closeBlogArticle(false);
    }

    if (document.body.classList.contains('portfolio-case-open') && pageId !== 'portfolios') {
        closePortfolioCaseStudy();
    }

    if (detailOverlay && detailOverlay.classList.contains('active')) {
        hideTeamDetailOverlay();
    }

    if (pageId === 'about' && isTeamSectionVisible()) {
        resetAboutView();
        state = 'about';
        return;
    }

    if (pageId !== 'about') {
        clearTeamHash();
        document.body.classList.remove('about-team-focus');
    }

    if (state === pageId) return;
    const previousState = state;
    clearTransitionBoundaryState(previousState);
    const transitionOwnerToken = ++videoTransitionToken;
    isAnimating = true;
    if (queuedSectionTransitionTarget === pageId) {
        queuedSectionTransitionTarget = null;
    }
    state = pageId;
    const seamlessIntroHandoff = consumeSeamlessIntroHandoff();
    const isSeamlessIntroHandoff = seamlessIntroHandoff.active;
    const seamlessIntroTransform = seamlessIntroHandoff.transform || null;
    const visibleSeamlessEquilibriumScale = seamlessIntroTransform?.scale ?? SECTION_CHAIN_HOME_SCALE;
    const isHomeEquilibriumSource = HOME_EQUILIBRIUM_STATES.has(previousState);
    const isEquilibriumIntroHandoff = isSeamlessIntroHandoff || isHomeEquilibriumSource;
    const hasForwardVideo = hasCinematicForwardVideo(pageId);
    const useBufferedIntroHandoff = isEquilibriumIntroHandoff && pageId !== 'services' && hasForwardVideo;
    const useEquilibriumNoVideoReveal = isEquilibriumIntroHandoff && pageId !== 'services' && !hasForwardVideo;
    const shouldScaleIntroFromVisibleHome = !isMobile && useBufferedIntroHandoff && isHomeEquilibriumSource && !isSeamlessIntroHandoff;
    const shouldScaleServicesFromVisibleHome = pageId === 'services' && isHomeEquilibriumSource && !isSeamlessIntroHandoff;
    const shouldScaleNoVideoFromVisibleHome = !isMobile && useEquilibriumNoVideoReveal && isHomeEquilibriumSource && !isSeamlessIntroHandoff;
    const mobileUniformScale = getMobileUniformCinematicScale();
    const mobileTargetScale = getMobileCinematicScaleForPage(pageId);
    const introEquilibriumScale = isEquilibriumIntroHandoff
        ? (isMobile
            ? (isSeamlessIntroHandoff ? visibleSeamlessEquilibriumScale : mobileTargetScale)
            : (isSeamlessIntroHandoff ? visibleSeamlessEquilibriumScale : HOME_EQUILIBRIUM_SCALE))
        : (isMobile ? mobileTargetScale : SECTION_CHAIN_HOME_SCALE);
    const introStartScale = pageId === 'contact' && isEquilibriumIntroHandoff
        ? getContactHandoffScale()
        : introEquilibriumScale;
    const visibleHomeSourceScale = (shouldScaleIntroFromVisibleHome || shouldScaleServicesFromVisibleHome || shouldScaleNoVideoFromVisibleHome)
        ? getVisibleHomeSourceScale()
        : introEquilibriumScale;
    const homeSectionIntroStartScale = (shouldScaleIntroFromVisibleHome || shouldScaleServicesFromVisibleHome)
        ? (isMobile ? getHomeLogoDisplayScale() : DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE)
        : introEquilibriumScale;
    const shouldScaleServicesIntroFromEquilibrium = !isMobile && pageId === 'services' && isEquilibriumIntroHandoff;
    const shouldSettleVisibleHomeBeforeIntro = false;
    const shouldSettleVisibleHomeBeforeNoVideo = false;
    const shouldSettleVisibleHomeBeforeServices = false;
    const visibleHomeHandoffScale = (shouldSettleVisibleHomeBeforeNoVideo || shouldSettleVisibleHomeBeforeServices)
        ? (isMobile ? mobileTargetScale : getVisibleHomeSourceScale())
        : (isMobile ? mobileTargetScale : HOME_EQUILIBRIUM_SCALE);
    const forwardVideoSrc = shouldScaleIntroFromVisibleHome
        ? getDesktopHomeDirectVideoSrc(pageId)
        : getVideoSrc(pageId);
    let bufferedIntroHandoffOptions = null;
    let introHandoffSettleTween = null;
    let servicesHomeSettleComplete = !shouldSettleVisibleHomeBeforeServices;
    let pendingServicesFrameCommit = null;
    const visibleVideoObjectPosition = pageId === 'contact' && (!useBufferedIntroHandoff || isMobile)
        ? getContactVideoObjectPosition()
        : 'center center';
    setContactVideoForegroundMode(false, {
        resetTransform: !(
            (isMobile && pageId === 'contact' && isEquilibriumIntroHandoff) ||
            (!isMobile && isHomeEquilibriumSource && !isSeamlessIntroHandoff)
        )
    });
    normalizePrimaryVideoState({
        objectPosition: visibleVideoObjectPosition
    });

    videoEl.style.objectPosition = visibleVideoObjectPosition;

    if (pageId === 'about') {
        resetAboutView({ revealSection: false, revealContent: false });
        gsap.set('.reveal-text', { opacity: 0, y: 24 });
    }

    suspendAllLocomotiveSections();

    // Fade out ANY currently active sections first
    const targetSectionId = pageId + '-section';
    const sections = document.querySelectorAll('.scroll-section');
    sections.forEach(sec => {
        if (sec.id === targetSectionId) {
            gsap.set(sec, useEquilibriumNoVideoReveal
                ? { autoAlpha: 0, visibility: 'visible', pointerEvents: 'none' }
                : { visibility: 'visible' });
            return;
        }

        if (sec.id === 'team-section') {
            hideTeamSection({ reset: true });
            return;
        }

        if (sec.id === 'blogs-section' && sec.classList.contains('active')) {
            animateBlogSectionOut();
            sec.classList.remove('active');
            setElementInteractivity(sec, false);
            gsap.delayedCall(0.32, () => gsap.set(sec, { autoAlpha: 0, visibility: 'hidden' }));
            return;
        }

        hideSection(sec);
    });
    
    // UI Out
    gsap.to("#hero-ui", { filter: "blur(7px)", opacity: 0, scale: 0.992, duration: 0.62, ease: "sine.inOut", overwrite: true, onComplete: () => {
        const heroUi = document.getElementById('hero-ui');
        if (heroUi) heroUi.style.display = "none";
    }});
    if (isMobile) {
        gsap.to("#center-nav", { opacity: 0, pointerEvents: 'none', duration: 0.52, ease: "sine.inOut" });
    } else {
        gsap.to("#center-nav", { opacity: 1, pointerEvents: 'auto', duration: 0.28, ease: "sine.out" });
    }
    gsap.to(document.getElementById('status-label'), { opacity: 0, duration: 0.52, ease: "sine.inOut" });
    
    // Video positioning
    if (pageId === 'services') {
        if (shouldSettleVisibleHomeBeforeServices) {
            introHandoffSettleTween = gsap.to(videoEl, {
                x: 0,
                y: '0vh',
                scale: visibleHomeHandoffScale,
                duration: 0.62,
                ease: "sine.inOut",
                overwrite: 'auto',
                onComplete: () => {
                    servicesHomeSettleComplete = true;
                    if (pendingServicesFrameCommit) {
                        const pendingVideo = pendingServicesFrameCommit;
                        pendingServicesFrameCommit = null;
                        pendingVideo();
                    }
                }
            });
        } else {
            gsap.set(videoEl, {
                x: 0,
                y: '0vh',
                scale: shouldScaleServicesFromVisibleHome
                    ? visibleHomeSourceScale
                    : (isEquilibriumIntroHandoff ? introEquilibriumScale : getHomeLogoDisplayScale())
            });
        }
    } else {
        const targetY = "0vh";
        const handoffOffset = getResolvedIntroHandoffOffset(pageId, isEquilibriumIntroHandoff);
        if (useBufferedIntroHandoff) {
            const directHomeIntroStartTime = shouldScaleIntroFromVisibleHome
                ? getDesktopHomeDirectIntroStartTime(pageId)
                : 0;
            bufferedIntroHandoffOptions = {
                buffered: true,
                allowMobileBuffered: isMobile && (pageId === 'about' || pageId === 'contact'),
                mobileCrossfade: isMobile && pageId === 'contact',
                startTime: isMobile && isSeamlessIntroHandoff && pageId === 'contact'
                    ? MOBILE_CONTACT_CHAIN_INTRO_START_TIME
                    : (isMobile && isSeamlessIntroHandoff && pageId === 'about'
                        ? MOBILE_ABOUT_CHAIN_INTRO_START_TIME
                        : (directHomeIntroStartTime || ((!isMobile && isSeamlessIntroHandoff && pageId === 'about')
                            ? DESKTOP_ABOUT_CHAIN_INTRO_START_TIME
                            : 0))),
                instantReveal: shouldScaleIntroFromVisibleHome,
                startTransform: {
                    scale: pageId === 'contact'
                        ? getContactHandoffScale()
                        : (shouldScaleIntroFromVisibleHome ? homeSectionIntroStartScale : introStartScale),
                    x: handoffOffset.x,
                    y: handoffOffset.y
                },
                endTransform: {
                    scale: isMobile ? mobileTargetScale : 1,
                    x: 0,
                    y: targetY,
                    duration: isMobile && isSeamlessIntroHandoff && pageId === 'about'
                        ? 0.78
                        : (shouldScaleIntroFromVisibleHome
                            ? getDesktopHomeDirectIntroDuration(pageId)
                            : DESKTOP_SECTION_CHAIN_INTRO_HANDOFF_DURATION),
                    delay: isMobile && isSeamlessIntroHandoff && pageId === 'about' ? 0.18 : 0,
                    ease: "sine.inOut"
                }
            };
            // The outgoing frame keeps its own transform; the hidden buffer owns
            // the incoming intro scale until activateBufferedVideo swaps them.
            if (shouldSettleVisibleHomeBeforeIntro) {
                primeBufferedHandoffVideo(forwardVideoSrc, bufferedIntroHandoffOptions.startTransform);
                introHandoffSettleTween = gsap.to(videoEl, {
                    scale: visibleHomeHandoffScale,
                    x: handoffOffset.x,
                    y: handoffOffset.y,
                    duration: 0.62,
                    ease: "sine.inOut",
                    overwrite: 'auto'
                });
            }
        } else if (useEquilibriumNoVideoReveal) {
            if (shouldSettleVisibleHomeBeforeNoVideo) {
                introHandoffSettleTween = gsap.to(videoEl, {
                    scale: visibleHomeHandoffScale,
                    x: handoffOffset.x,
                    y: handoffOffset.y,
                    duration: 0.62,
                    ease: "sine.inOut",
                    overwrite: 'auto'
                });
            } else {
                gsap.set(videoEl, {
                    scale: shouldScaleNoVideoFromVisibleHome ? visibleHomeSourceScale : introEquilibriumScale,
                    x: handoffOffset.x,
                    y: handoffOffset.y
                });
            }
        } else if (isEquilibriumIntroHandoff && (handoffOffset.x || handoffOffset.y)) {
            gsap.set(videoEl, { x: handoffOffset.x, y: handoffOffset.y });
        }
        if (!useBufferedIntroHandoff && !useEquilibriumNoVideoReveal) {
            gsap.to(videoEl, {
                scale: isMobile ? mobileTargetScale : 1,
                x: 0,
                y: targetY,
                duration: isSeamlessIntroHandoff ? 0.54 : 0.68,
                ease: "power2.inOut",
                overwrite: 'auto'
            });
        }
    }
    
    if (pageId === 'about') {
        document.body.classList.add('anti-gravity-active');
    } else {
        document.body.classList.remove('anti-gravity-active');
    }

    // Services uses its own dedicated videos. Tune Services scale/crop mostly in CSS
    // (#services-bg-video and #services-loop-video), not in the global #bg-video path.
    if (pageId === 'services') {
        // Hide custom cursor on services page for a clean cinematic look
        setCustomCursorVisibility(false);
        configureServicesCinematicSources();

        // Commit Services only after its first decoded frame is ready, so the
        // home logo and Services intro never own the same visible frame.
        const section = document.getElementById('services-section');
            if (section) {
                const frameSynchronizedServicesHandoff = true;
                let servicesFrameCommitted = false;
                let servicesGradientFadeStarted = false;
                const fadeServicesGradientIn = () => {
                    if (servicesGradientFadeStarted) return;
                    servicesGradientFadeStarted = true;
                    gsap.killTweensOf('.services-gradient-overlay');
                    gsap.set('.services-gradient-overlay', {
                        opacity: 0,
                        scale: 1.2,
                        filter: 'blur(96px)'
                    });
                    gsap.to('.services-gradient-overlay', {
                        opacity: 0.66,
                        scale: 1.1,
                        filter: 'blur(84px)',
                        duration: 1.18,
                        delay: 0.02,
                        ease: "sine.inOut",
                        overwrite: true
                    });
                };
                const commitServicesFirstFrame = (servicesVideo) => {
                    if (transitionOwnerToken !== videoTransitionToken) return;
                    if (!frameSynchronizedServicesHandoff || servicesFrameCommitted) return;
                    if (!servicesHomeSettleComplete) {
                        pendingServicesFrameCommit = () => commitServicesFirstFrame(servicesVideo);
                        return;
                    }
                    servicesFrameCommitted = true;
                    section.classList.add('active');
                    setElementInteractivity(section, true);
                    if (isMobile) {
                        gsap.set(section, { visibility: 'visible' });
                        gsap.to(section, {
                            autoAlpha: 1,
                            duration: SECTION_MEDIA_FADE_IN_DURATION,
                            ease: "sine.out",
                            overwrite: true
                        });
                    } else {
                        gsap.set(section, { visibility: 'visible', autoAlpha: 1 });
                    }
                    fadeServicesGradientIn();
                    if (servicesVideo) {
                        if (isMobile) {
                            gsap.to(servicesVideo, {
                                opacity: 1,
                                duration: SECTION_MEDIA_FADE_IN_DURATION,
                                ease: "sine.out",
                                overwrite: true
                            });
                        } else {
                            gsap.set(servicesVideo, { opacity: 1 });
                        }
                        if (shouldScaleServicesIntroFromEquilibrium) {
                            gsap.to(servicesVideo, {
                                scale: 1,
                                duration: shouldScaleServicesFromVisibleHome
                                    ? 1.45
                                    : DESKTOP_SECTION_CHAIN_INTRO_HANDOFF_DURATION,
                                delay: shouldScaleServicesFromVisibleHome ? 0.36 : 0,
                                ease: "sine.inOut",
                                overwrite: 'auto'
                            });
                        }
                    }
                    if (isMobile) {
                        gsap.to(videoEl, {
                            opacity: 0,
                            duration: SECTION_MEDIA_FADE_OUT_DURATION,
                            ease: "sine.inOut",
                            overwrite: true,
                            onComplete: () => {
                                if (transitionOwnerToken === videoTransitionToken) {
                                    gsap.set(videoEl, { clearProps: 'filter' });
                                }
                            }
                        });
                    } else {
                        gsap.set(videoEl, { opacity: 0, clearProps: 'filter' });
                    }
                    if (isMobile) {
                        gsap.to('.services-text-overlay', {
                            opacity: 1,
                            duration: 0.72,
                            delay: MOBILE_SERVICES_LABEL_REVEAL_DELAY,
                            ease: "sine.out",
                            overwrite: true
                        });
                        gsap.delayedCall(0.25, () => finishForwardSectionTransition(transitionOwnerToken));
                    }
                    setTimeout(() => {
                        if (transitionOwnerToken === videoTransitionToken) {
                            videoEl.pause();
                        }
                    }, 180);
                };

            if (frameSynchronizedServicesHandoff) {
                section.classList.add('active');
                setElementInteractivity(section, true);
                gsap.set(section, { visibility: 'visible', autoAlpha: 0 });
            } else {
                showSection(section, { duration: 0.96 });
            }
            gsap.set('.services-gradient-overlay', { opacity: 0, scale: 1.12, filter: 'blur(92px)' });
            if (!frameSynchronizedServicesHandoff) {
                fadeServicesGradientIn();
            }

            // Play the dedicated services background videos (Seamless Intro -> Loop)
            const servicesVideo = document.getElementById('services-bg-video');
            const servicesLoop = document.getElementById('services-loop-video');
            if (servicesVideo) {
                // Reset states
                gsap.killTweensOf([servicesVideo, servicesLoop]);
                const servicesHandoffOffset = getResolvedIntroHandoffOffset('services', isEquilibriumIntroHandoff);
                gsap.set(servicesVideo, {
                    opacity: 0,
                    visibility: 'visible',
                    scale: shouldScaleServicesFromVisibleHome
                        ? homeSectionIntroStartScale
                        : (shouldScaleServicesIntroFromEquilibrium ? introEquilibriumScale : 1),
                    x: servicesHandoffOffset.x,
                    y: servicesHandoffOffset.y,
                    filter: 'blur(0px)',
                    transformOrigin: '50% 50%'
                });
                if (servicesLoop) {
                    try { servicesLoop.pause(); } catch (_) {}
                    gsap.set(servicesLoop, { opacity: 0, visibility: 'hidden', x: 0, y: 0, filter: 'blur(0px)' });
                }
                gsap.set('.services-text-overlay', { opacity: 0 }); // Hide text during intro
                
                servicesVideo.loop = false;
                try {
                    servicesVideo.currentTime = shouldScaleServicesFromVisibleHome
                        ? getDesktopHomeDirectIntroStartTime('services')
                        : 0;
                } catch (_) {}
                
                const revealWhenFrameIsReady = () => {
                    if (typeof servicesVideo.requestVideoFrameCallback === 'function') {
                        servicesVideo.requestVideoFrameCallback(() => commitServicesFirstFrame(servicesVideo));
                    } else {
                        requestAnimationFrame(() => commitServicesFirstFrame(servicesVideo));
                    }
                };

                const servicesPlayPromise = servicesVideo.play();
                if (servicesPlayPromise !== undefined) {
                    servicesPlayPromise.then(revealWhenFrameIsReady).catch(e => {
                        console.log('Services video play prevented', e);
                        commitServicesFirstFrame(servicesVideo);
                    });
                } else {
                    revealWhenFrameIsReady();
                }
                setTimeout(() => {
                    if (transitionOwnerToken === videoTransitionToken) {
                        commitServicesFirstFrame(servicesVideo);
                    }
	                }, 150);
                if (!frameSynchronizedServicesHandoff && (servicesHandoffOffset.x || servicesHandoffOffset.y)) {
                    gsap.to(servicesVideo, {
                        x: 0,
                        y: 0,
                        duration: isEquilibriumIntroHandoff ? 0.38 : 0.58,
                        delay: isEquilibriumIntroHandoff ? 0 : 1.08,
                        ease: "sine.inOut",
                        overwrite: 'auto',
                        onComplete: () => gsap.set(servicesVideo, { clearProps: 'filter' })
                    });
                } else {
                    gsap.set(servicesVideo, { clearProps: 'filter' });
                }
                
                const startServicesAmbientLoop = () => {
                    if (transitionOwnerToken !== videoTransitionToken) {
                        return;
                    }
                    servicesVideo.removeEventListener('ended', startServicesAmbientLoop);
                    servicesVideo.removeEventListener('timeupdate', checkTime);
                    servicesVideo._startAmbientLoop = null;
                    servicesVideo._checkTime = null;

                    const loopSrc = getServicesCinematicSource('loop');
	                    const showServicesText = () => {
	                        gsap.to('.services-text-overlay', { opacity: 1, duration: 0.46, delay: 0.02, ease: "sine.out" });
                    };

                    if (servicesLoop) {
                        if (!videoUsesSource(servicesLoop, loopSrc)) {
                            servicesLoop.src = loopSrc;
                            servicesLoop.load();
                        }
                        servicesLoop.loop = true;
                        try { servicesLoop.currentTime = 0; } catch (_) {}
                        gsap.set(servicesLoop, { opacity: 0, visibility: 'visible', x: 0, y: 0, filter: 'blur(0px)' });

                        const commitLoopFrame = () => {
                            if (transitionOwnerToken !== videoTransitionToken) return;
	                            gsap.to(servicesLoop, { opacity: 1, duration: isMobile ? SECTION_MEDIA_FADE_IN_DURATION : 0.24, ease: "sine.out", overwrite: true });
	                            gsap.to(servicesVideo, {
	                                opacity: 0,
	                                duration: isMobile ? SECTION_MEDIA_FADE_OUT_DURATION : 0.26,
                                ease: "sine.inOut",
                                overwrite: true,
                                onComplete: () => {
                                    if (transitionOwnerToken !== videoTransitionToken) return;
                                    try { servicesVideo.pause(); } catch (_) {}
                                    gsap.set(servicesVideo, { visibility: 'hidden' });
                                }
                            });
                            showServicesText();
                            finishForwardSectionTransition(transitionOwnerToken);
                        };

                        const loopPlay = servicesLoop.play();
                        if (loopPlay && typeof loopPlay.then === 'function') {
                            loopPlay.then(() => waitForFirstDecodedFrame(servicesLoop, commitLoopFrame, true)).catch(e => {
                                console.log('Services loop play prevented', e);
                                commitLoopFrame();
                            });
                        } else {
                            waitForFirstDecodedFrame(servicesLoop, commitLoopFrame, true);
                        }
                        return;
                    }

                    if (!videoUsesSource(servicesVideo, loopSrc)) {
                        servicesVideo.src = loopSrc;
                        servicesVideo.load();
                    }
                    servicesVideo.loop = true;
                    try { servicesVideo.currentTime = 0; } catch (_) {}
                    const loopPlay = servicesVideo.play();
                    if (loopPlay && typeof loopPlay.catch === 'function') {
                        loopPlay.catch(e => console.log('Services loop play prevented', e));
                    }

                    gsap.set(servicesVideo, { opacity: 1, visibility: 'visible', clearProps: 'filter' });
                    showServicesText();
                    finishForwardSectionTransition(transitionOwnerToken);
                };

                const checkTime = () => {
                    if (transitionOwnerToken !== videoTransitionToken) {
                        servicesVideo.removeEventListener('timeupdate', checkTime);
                        servicesVideo.removeEventListener('ended', startServicesAmbientLoop);
                        return;
                    }
                    if (servicesVideo.duration && servicesVideo.currentTime >= servicesVideo.duration - 0.12) {
                        startServicesAmbientLoop();
                    }
                };
                
                if (servicesVideo._checkTime) {
                    servicesVideo.removeEventListener('timeupdate', servicesVideo._checkTime);
                }
                if (servicesVideo._startAmbientLoop) {
                    servicesVideo.removeEventListener('ended', servicesVideo._startAmbientLoop);
                }
                servicesVideo._checkTime = checkTime;
                servicesVideo._startAmbientLoop = startServicesAmbientLoop;
                servicesVideo.addEventListener('timeupdate', checkTime);
                servicesVideo.addEventListener('ended', startServicesAmbientLoop);
            } else {
                finishForwardSectionTransition(transitionOwnerToken);
            }
        } else {
            finishForwardSectionTransition(transitionOwnerToken);
        }
        return;
    }

    const shouldLoop = false;

    if ((pageId === 'portfolios' || pageId === 'blogs') && useEquilibriumNoVideoReveal) {
        const startNoVideoIntro = () => {
            animateNoVideoLogoIntro(pageId, transitionOwnerToken, () => {
                finishForwardSectionTransition(transitionOwnerToken);
            });
        };

        if (pageId === 'portfolios') {
            waitForTransitionAudioToFinish('portfolios', transitionOwnerToken, startNoVideoIntro);
        } else {
            startNoVideoIntro();
        }
        return;
    }

    const useSeamlessForwardPlayback = isEquilibriumIntroHandoff || isSeamlessIntroHandoff || Boolean(bufferedIntroHandoffOptions);
    const forwardCompletionLead = pageId === 'about' && isMobile
        ? ABOUT_INTRO_COMPLETION_LEAD_MOBILE
        : (pageId === 'contact'
            ? (isMobile ? CONTACT_INTRO_COMPLETION_LEAD_MOBILE : CONTACT_INTRO_COMPLETION_LEAD)
            : (useSeamlessForwardPlayback ? 0.015 : 0.08));
    const startForwardVideoPlayback = () => playVideo(forwardVideoSrc, () => {
        const section = document.getElementById(pageId + '-section');
        if(section) {
            const duration = (pageId === 'about') ? 0.62 : 0.67;
            if (pageId === 'blogs') {
                gsap.set(section, { visibility: 'visible', autoAlpha: 0 });
                section.classList.add('active');
                setElementInteractivity(section, true);
                animateBlogSectionIn();
            } else {
                showSection(section, { duration });
            }
            if (locomotiveRegistry[section.id]) {
                activateLocomotiveSection(section.id, { reset: true });
            }
            
            if (pageId === 'about') {
                hydrateLazyBackgrounds(section);
                setElementInteractivity(document.querySelector('.about-content'), true);
                gsap.to('.about-content', {
                    opacity: 1,
                    scale: 1,
                    duration: 0.58,
                    delay: 0.14,
                    pointerEvents: 'auto',
                    ease: "sine.out"
                });
                videoEl.playbackRate = isMobile ? 1 : 1.5; // Let the mobile logo settle before freezing.
                if (isMobile) {
                    const freezeAboutLogoFrame = () => {
                        if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.05) {
                            videoEl.pause();
                            removeManagedVideoListener('timeupdate', '_managedTimeupdateHandler');
                        }
                    };
                    addManagedVideoListener('timeupdate', '_managedTimeupdateHandler', freezeAboutLogoFrame);
                }
                gsap.to('.reveal-text', { opacity: 1, y: 0, stagger: 0.12, duration: 0.54, delay: 0.2, ease: "sine.out" });
            }

            if (pageId === 'contact') {
                setContactVideoForegroundMode(!isMobile);

                // Hide custom cursor
                setCustomCursorVisibility(false);

                gsap.set('.contact-plum-glow', { opacity: 0, scale: 1.06, filter: 'blur(44px)' });
                gsap.set('.contact-reveal', { opacity: 0, y: 24 });
                gsap.set('.contact-social-link', { opacity: 0, y: 18 });

                const contactCopyDelay = isMobile ? 0.82 : 0.12;
                const contactGlowDelay = isMobile ? 0.24 : 0;

                if (isMobile) {
                    slideMobileContactVideoDown();
                }

                gsap.to('.contact-plum-glow', {
                    opacity: 0.5,
                    scale: 1.04,
                    filter: 'blur(30px)',
                    duration: 1.15,
                    delay: contactGlowDelay,
                    ease: 'power2.out'
                });
                gsap.to('.contact-reveal', {
                    opacity: 1,
                    y: 0,
                    stagger: 0.1,
                    duration: 0.65,
                    delay: contactCopyDelay,
                    ease: 'power2.out'
                });
                gsap.to('.contact-social-link', {
                    opacity: 1,
                    y: 0,
                    stagger: 0.05,
                    duration: 0.45,
                    delay: isMobile ? contactCopyDelay + 0.2 : 0.34,
                    ease: 'power2.out'
                });
                
                // Ensure the video freezes on its very last frame instead of resetting
                const freezeAtEnd = () => {
                    if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.05) {
                        videoEl.pause();
                        removeManagedVideoListener('timeupdate', '_managedTimeupdateHandler');
                    }
                };
                addManagedVideoListener('timeupdate', '_managedTimeupdateHandler', freezeAtEnd);
            }

            if (pageId === 'portfolios') {
                revealPortfolioSectionContent(section);
            }
        }
        finishForwardSectionTransition();
    }, useSeamlessForwardPlayback, shouldLoop, 1.0, forwardCompletionLead, bufferedIntroHandoffOptions || {});

    if (introHandoffSettleTween && (shouldSettleVisibleHomeBeforeIntro || shouldSettleVisibleHomeBeforeNoVideo)) {
        introHandoffSettleTween.eventCallback('onComplete', startForwardVideoPlayback);
    } else {
        startForwardVideoPlayback();
    }
}

function initScrollReveals() {
    const reveals = document.querySelectorAll('.reveal-text');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px",
        root: document.getElementById('about-section')
    });

    reveals.forEach(el => observer.observe(el));
}
initScrollReveals();

function isTeamSectionVisible() {
    const teamSec = document.getElementById('team-section');
    return !!teamSec && teamSec.classList.contains('active') && teamSec.style.visibility !== 'hidden';
}

function clearTeamHash() {
    if (window.location.hash !== '#team') return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
}

function canOpenTeamExperience() {
    const aboutSection = document.getElementById('about-section');
    return state === 'about' && !!aboutSection && aboutSection.classList.contains('active');
}

function hideTeamDetailOverlay() {
    if (detailOverlay) {
        detailOverlay.classList.remove('active');
        setElementInteractivity(detailOverlay, false);
    }
}

function hideTeamSection({ reset = true } = {}) {
    const teamSec = document.getElementById('team-section');
    if (!teamSec) return;

    gsap.killTweensOf(teamSec);
    gsap.set(teamSec, { autoAlpha: 0 });
    teamSec.classList.remove('active');
    setElementInteractivity(teamSec, false);
    deactivateLocomotiveSection('team-section', { reset });
}

function showTeamSection({ duration = 0.53, reset = true } = {}) {
    const teamSec = document.getElementById('team-section');
    if (!teamSec) return;

    hideTeamDetailOverlay();
    hydrateLazyBackgrounds(teamSec);
    gsap.killTweensOf(teamSec);
    teamSec.classList.add('active');
    setElementInteractivity(teamSec, true);
    gsap.set(teamSec, { visibility: 'visible' });
    gsap.to(teamSec, { autoAlpha: 1, duration, ease: "power2.out" });
    activateLocomotiveSection('team-section', { reset });
}

function openTeamExperience({ duration = 0.53, reset = true, syncHash = true } = {}) {
    if (!canOpenTeamExperience()) {
        clearTeamHash();
        return;
    }

    if (isTeamSectionVisible()) {
        if (syncHash && window.location.hash !== '#team') {
            history.pushState(null, '', '#team');
        }
        return;
    }

    const aboutContent = document.querySelector('.about-content');
    if (aboutContent) {
        gsap.killTweensOf(aboutContent);
        gsap.to(aboutContent, {
            opacity: 0,
            scale: 0.95,
            duration: 0.27,
            pointerEvents: 'none'
        });
        setElementInteractivity(aboutContent, false);
    }

    showTeamSection({ duration, reset });
    animateTeamMembersIn();

    if (syncHash && window.location.hash !== '#team') {
        history.pushState(null, '', '#team');
    }
}

function animateTeamMembersIn() {
    gsap.fromTo('#team-section .member',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.02, duration: 0.4, ease: "back.out(1.7)", delay: 0.13 }
    );
}

function resetAboutView({ revealSection = true, revealContent = true } = {}) {
    const aboutSection = document.getElementById('about-section');
    const aboutContent = document.querySelector('.about-content');

    if (aboutSection) {
        aboutSection.classList.toggle('active', revealSection);
        setElementInteractivity(aboutSection, revealSection);
        gsap.set(aboutSection, revealSection
            ? { autoAlpha: 1, visibility: 'visible' }
            : { autoAlpha: 0, visibility: 'hidden' });
        resetSectionScrollPosition('about-section');
        updateLocomotiveSection('about-section');
        updateAboutTeamVideoFocus();
    }

    if (aboutContent) {
        setElementInteractivity(aboutContent, revealContent);
        gsap.set(aboutContent, revealContent
            ? { opacity: 1, scale: 1, pointerEvents: 'auto' }
            : { opacity: 0, scale: 1, pointerEvents: 'none' });
    }

    hideTeamDetailOverlay();
    hideTeamSection({ reset: true });

    clearTeamHash();
    document.body.classList.remove('about-team-focus');
}

function returnToStableHomeDirectly() {
    if (isAnimating) return;
    isAnimating = true;
    clearTransitionBoundaryState(state);
    setContactVideoForegroundMode(false);
    suspendAllLocomotiveSections();
    clearTeamHash();
    stopTransitionAudio();

    if (isBlogArticleOverlayOpen) {
        window.closeBlogArticle(false);
    }
    if (detailOverlay) {
        hideTeamDetailOverlay();
    }

    settleSectionsForHome();

    const heroUi = document.getElementById('hero-ui');
    if (heroUi) {
        heroUi.style.display = 'grid';
        gsap.set(heroUi, { opacity: 0, filter: 'blur(7px)', scale: 1.008 });
    }
    gsap.set('#center-nav', { opacity: 0, pointerEvents: 'none' });
    gsap.set(document.getElementById('status-label'), { opacity: 0 });

    commitRuntimeHomeEquilibriumFrame(() => {
        gsap.set(videoEl, {
            scale: getHomeLogoDisplayScale(),
            x: 0,
            y: '0vh'
        });
        state = 'stabilize';
        document.body.classList.remove('anti-gravity-active');
        if (heroUi) {
            gsap.to(heroUi, {
                filter: 'blur(0px)',
                opacity: 1,
                scale: 1,
                duration: 0.54,
                ease: 'sine.out',
                overwrite: true
            });
        }
        gsap.to('#center-nav', {
            opacity: 1,
            pointerEvents: 'auto',
            duration: 0.34,
            ease: 'sine.out',
            onStart: () => setHeroNavReady(true)
        });
        gsap.to(document.getElementById('status-label'), { opacity: 1, duration: 0.44, ease: 'sine.out' });
        setCustomCursorVisibility(true, 0.2);
        scheduleBackgroundWarmup();
        primeDesktopHomeDirectContactHandoff();
        isAnimating = false;
        runQueuedSectionTransition();
    }, { crossfade: false });
}

function backToHome() {
    if (isAnimating) return;
    if (state === 'contact') {
        playTransitionAudio('contactHome');
    } else {
        stopTransitionAudio();
    }
    if (isMobile && state === 'mobile-landing') {
        enterMobileHomeState();
        return;
    }
    if (isMobile && state === 'mobile-nav') {
        const currentHomeScale = Number(gsap.getProperty(videoEl, 'scale'));
        enterMobileHomeState({
            showNavigation: true,
            settleScale: Number.isFinite(currentHomeScale) && currentHomeScale > 0
                ? currentHomeScale
                : getHomeLogoDisplayScale()
        });
        return;
    }
    if (isMobile && document.body.classList.contains('show-mobile-nav')) {
        fadeMobileNavOut();
    }

    if (!isMobile) {
        if (HOME_EQUILIBRIUM_STATES.has(state) && !isTeamSectionVisible()) return;
        executeFinalReverse();
        return;
    }

    const teamSec = document.getElementById('team-section');
    const isFromTeam = isTeamSectionVisible();

    if (isFromTeam) {
        isAnimating = true;
        hideTeamDetailOverlay();
        deactivateLocomotiveSection('team-section', { reset: true });

        // Fade out the team overlay, then reverse straight to the hero.
        gsap.to(teamSec, {
            autoAlpha: 0,
            duration: 0.27,
            onStart: () => {
                teamSec.classList.remove('active');
                setElementInteractivity(teamSec, false);
            },
            onComplete: () => {
                isAnimating = false;
                executeFinalReverse();
            }
        });
    } else {
        executeFinalReverse();
    }
}

function executeFinalReverse(options = {}) {
    const {
        revealHomeUi = true,
        onHomeSettled = null,
        equilibriumTransform = null,
        reverseEndTransform = null,
        chainedTargetPageId = null
    } = options;
    if (isAnimating) return;
    isAnimating = true;
    clearTransitionBoundaryState(state);
    setContactVideoForegroundMode(false);
    suspendAllLocomotiveSections();
    clearTeamHash();
    if (isBlogArticleOverlayOpen) {
        window.closeBlogArticle(false);
    }
    if (detailOverlay) {
        hideTeamDetailOverlay();
    }

    // Fade out current sections
    const activeSection = document.querySelector('.scroll-section.active');
    const aboutContent = document.querySelector('.about-content');
    const isServicesReverse = state === 'services';
    let reversePageId = state;
    if (state !== 'services' && state !== 'contact' && state !== 'blogs' && state !== 'portfolios') {
        reversePageId = 'about';
    }
    const reverseSrc = getVideoSrc(reversePageId, true);
    const isPortfolioNoVideoReverse = reversePageId === 'portfolios' && !reverseSrc;
    const isNoVideoChainedReverse = !reverseSrc && !revealHomeUi;
    const isAboutReverse = reversePageId === 'about' || activeSection?.id === 'about-section';
    const isContactReverse = reversePageId === 'contact';
    const currentReverseTransform = {
        scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage(reversePageId) : 1),
        x: Number(gsap.getProperty(videoEl, 'x')) || 0,
        y: Number(gsap.getProperty(videoEl, 'y')) || 0
    };
    const defaultHomeSettleScale = revealHomeUi
        ? getRevealHomeVideoScale(reverseSrc)
        : (isMobile ? getMobileUniformCinematicScale() : HOME_EQUILIBRIUM_SCALE);
    const mobileHomeReturnTransform = (isMobile && revealHomeUi && isAboutReverse)
        ? { scale: defaultHomeSettleScale, x: 0, y: "0vh" }
        : null;
    const desktopHomeReturnReferenceTransform = (!isMobile && revealHomeUi && !isAboutReverse)
        ? { scale: DESKTOP_HOME_RETURN_REFERENCE_SCALE, x: 0, y: "0vh" }
        : null;
    const resolvedReverseEndTransform = reverseEndTransform
        || (isContactReverse
            ? (mobileHomeReturnTransform || desktopHomeReturnReferenceTransform || { scale: getContactHandoffScale(), x: 0, y: 0 })
            : (isAboutReverse ? (mobileHomeReturnTransform || currentReverseTransform) : (desktopHomeReturnReferenceTransform || equilibriumTransform)));
    const homeSettleScale = resolvedReverseEndTransform?.scale ?? equilibriumTransform?.scale ?? defaultHomeSettleScale;
    const homeSettleX = resolvedReverseEndTransform?.x ?? equilibriumTransform?.x ?? 0;
    const homeSettleY = resolvedReverseEndTransform?.y ?? equilibriumTransform?.y ?? "0vh";
    const reverseCompletionLead = (!revealHomeUi && !isMobile && isServicesReverse)
        ? DESKTOP_SERVICES_CHAIN_REVERSE_COMPLETION_LEAD
        : (!revealHomeUi && !isMobile && isContactReverse)
            ? DESKTOP_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD
            : DESKTOP_SECTION_CHAIN_REVERSE_COMPLETION_LEAD;
    const reversePlaybackRate = isContactReverse
        ? getContactExtroPlaybackRate()
        : REVERSE_PLAYBACK_RATE;
    // Mobile chained extro cutoff. Larger values cut away earlier before the extro reaches its final logo frame.
    const mobileReverseCompletionLead = (!revealHomeUi && isMobile && isContactReverse && chainedTargetPageId === 'about')
        ? MOBILE_CONTACT_ABOUT_REVERSE_COMPLETION_LEAD
        : (!revealHomeUi && isMobile && isContactReverse && chainedTargetPageId === 'services')
            ? CONTACT_EXTRO_EQUILIBRIUM_LEAD
            : ((!revealHomeUi && isMobile && chainedTargetPageId === 'contact')
                ? (isServicesReverse ? MOBILE_SERVICES_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD : MOBILE_CONTACT_CHAIN_REVERSE_COMPLETION_LEAD)
                : MOBILE_SECTION_CHAIN_REVERSE_COMPLETION_LEAD);

    if (activeSection) {
        if (!isServicesReverse) {
            if (isAboutReverse) {
                activeSection.classList.remove('active');
                setElementInteractivity(activeSection, false);
            }
            const sectionFadeDuration = isPortfolioNoVideoReverse ? 0.58 : (isNoVideoChainedReverse ? 0.16 : (isAboutReverse ? 0.18 : 0.52));
            gsap.to(activeSection, { opacity: 0, duration: sectionFadeDuration, ease: isNoVideoChainedReverse || isAboutReverse ? "sine.out" : "sine.inOut", onComplete: () => {
                activeSection.classList.remove('active');
                setElementInteractivity(activeSection, false);
                gsap.set(activeSection, { autoAlpha: 0, visibility: 'hidden' });
            }});
        } else {
            activeSection.classList.remove('active');
            setElementInteractivity(activeSection, false);
        }
    }
    
    if (aboutContent) {
        gsap.to(aboutContent, { opacity: 0, duration: isAboutReverse ? 0.18 : 0.52, ease: isAboutReverse ? "sine.out" : "sine.inOut" });
    }

    if (!isMobile && !isServicesReverse && reverseSrc) {
        primeBufferedHandoffVideo(reverseSrc);
    }

    if (isMobile && (isAboutReverse || isContactReverse) && reverseSrc) {
        const reverseScalePage = isContactReverse ? 'contact' : 'about';
        gsap.set(videoEl, {
            scale: getMobileCinematicScaleForPage(reverseScalePage),
            x: 0,
            y: '0vh',
            transformOrigin: '50% 50%'
        });
    }

    if (isServicesReverse) {
        // Clear Services UI quickly; the cinematic continuity should be owned
        // by the decoded reverse video frame, not by a long opacity crossfade.
        gsap.to('.services-text-overlay', { opacity: 0, duration: 0.18, ease: "sine.out", overwrite: true });
        gsap.to('.services-gradient-overlay', {
            opacity: 0,
            scale: 1.2,
            filter: 'blur(160px)',
            duration: 0.78,
            ease: "sine.inOut",
            overwrite: true
        });
    } else if (isPortfolioNoVideoReverse) {
        animatePortfolioLogoExit({
            scale: homeSettleScale,
            x: homeSettleX,
            y: homeSettleY,
            transitionOwnerToken: videoTransitionToken + 1
        });
    } else {
        gsap.to(videoEl, { opacity: 1, duration: 0.5, ease: "sine.inOut" });
    }

    let servicesReverseRevealed = false;
    const scheduleChainedReverseEquilibriumTween = () => {
        // Chained reverses should arrive at the next intro scale before the buffered/crossfaded intro starts.
        // About returns to the exact home logo scale; Contact keeps its smaller handoff scale because that clip artwork is larger.
        if ((!revealHomeUi && isAboutReverse) || (revealHomeUi && !isAboutReverse && !isContactReverse)) return;

        const transformDuration = isMobile
            ? MOBILE_SECTION_CHAIN_REVERSE_SETTLE_DURATION
            : DESKTOP_SECTION_CHAIN_REVERSE_SETTLE_DURATION;
        const transformLead = isMobile ? mobileReverseCompletionLead : reverseCompletionLead;
        const mediaDuration = Number(videoEl.duration);
        const mediaCurrentTime = Number(videoEl.currentTime) || 0;
        const mediaRate = Math.max(0.01, Math.abs(videoEl.playbackRate || reversePlaybackRate || 1));
        const mediaUntilCompletion = Math.max(0, Math.max(0, mediaDuration - mediaCurrentTime) - transformLead);
        const transformDelay = Number.isFinite(mediaDuration) && mediaDuration > 0
            ? Math.max(0, (mediaUntilCompletion / mediaRate) - transformDuration)
            : (isMobile ? 0.12 : 0.62);

        gsap.to(videoEl, {
            scale: homeSettleScale,
            x: homeSettleX,
            y: homeSettleY,
            duration: transformDuration,
            delay: transformDelay,
            ease: "sine.inOut",
            overwrite: 'auto'
        });
    };

    const revealServicesReverse = () => {
        if (servicesReverseRevealed) return;
        servicesReverseRevealed = true;

        const servicesReverseScale = isMobile ? getMobileServicesMediaScale() : SECTION_CHAIN_HOME_SCALE;
        const servicesReverseOpacity = 1;
        gsap.killTweensOf([videoEl, '#services-loop-video', '#services-bg-video', '.services-text-overlay', '.services-gradient-overlay']);
        gsap.set(videoEl, {
            opacity: servicesReverseOpacity,
            scale: servicesReverseScale,
            x: 0,
            y: '0vh',
            filter: 'blur(0px)'
        });
        scheduleChainedReverseEquilibriumTween();
        gsap.set(['#services-loop-video', '#services-bg-video'], {
            opacity: 0,
            visibility: 'hidden'
        });
        gsap.set(['.services-text-overlay', '.services-gradient-overlay'], { opacity: 0 });

        if (activeSection) {
            gsap.killTweensOf(activeSection);
            gsap.set(activeSection, { autoAlpha: 0, visibility: 'hidden' });
        }
    };

    const reverseEndTransformOptions = (!isAboutReverse && (!revealHomeUi || isContactReverse)) ? {
        scale: homeSettleScale,
        x: homeSettleX,
        y: homeSettleY,
        duration: DESKTOP_SECTION_CHAIN_REVERSE_SETTLE_DURATION,
        ease: "sine.inOut",
        alignToEnd: true,
        lead: reverseCompletionLead
    } : null;

    const reverseHandoffOptions = !reverseSrc
        ? { noVideoDelay: isPortfolioNoVideoReverse ? Math.round(PORTFOLIO_LOGO_ZOOM_OUT_DURATION * 1000) : (activeSection ? (revealHomeUi ? 560 : 190) : 70) }
        : (!isMobile && !isServicesReverse ? {
            buffered: true,
            endTransform: reverseEndTransformOptions
        } : (isServicesReverse ? {
            initialOpacity: 0,
            revealOpacity: 1,
            beforeReveal: revealServicesReverse
        } : {
            endTransform: reverseEndTransformOptions
        }));

    playVideo(reverseSrc, () => {
        const finishHomeSettle = () => {
            state = 'stabilize';
            if (revealHomeUi && isMobile) {
                settleSectionsForHome();
                enterMobileHomeState({
                    showNavigation: true,
                    settleScale: homeSettleScale
                });
            }
            if (!revealHomeUi) {
                setHeroNavReady(false);
                gsap.set('#center-nav', { opacity: 0, pointerEvents: 'none' });
                gsap.set(document.getElementById('status-label'), { opacity: 0 });
            }
            isAnimating = false;
            document.body.classList.remove('anti-gravity-active');
            if (typeof onHomeSettled === 'function') {
                onHomeSettled();
            } else {
                primeDesktopHomeDirectContactHandoff();
                runQueuedSectionTransition();
            }
        };

        const heroUi = document.getElementById('hero-ui');
        if (heroUi && revealHomeUi) {
            heroUi.style.display = "grid";
            gsap.set(heroUi, { opacity: 0, filter: "blur(7px)", scale: 1.008 });
            gsap.to(heroUi, { filter: "blur(0px)", opacity: 1, scale: 1, duration: 0.86, delay: 0.08, ease: "sine.out", overwrite: true });
        } else if (heroUi) {
            heroUi.style.display = "none";
            gsap.set(heroUi, { opacity: 0, filter: "blur(7px)", scale: 1 });
        }
        
        if (isPortfolioNoVideoReverse) {
            normalizePrimaryVideoState({
                opacity: 1,
                scale: homeSettleScale,
                x: homeSettleX,
                y: homeSettleY,
                objectPosition: 'center center',
                playbackRate: 1
            });
            finishHomeSettle();
        } else if (!revealHomeUi) {
            normalizePrimaryVideoState({
                opacity: 1,
                scale: homeSettleScale,
                x: homeSettleX,
                y: homeSettleY,
                objectPosition: 'center center',
                playbackRate: 1
            });
            finishHomeSettle();
        } else {
            gsap.to(videoEl, {
                scale: homeSettleScale,
                x: homeSettleX,
                y: homeSettleY,
                duration: 0.86,
                ease: "power3.inOut",
                overwrite: 'auto',
                onComplete: () => {
                    normalizePrimaryVideoState({
                        opacity: 1,
                        scale: homeSettleScale,
                        x: homeSettleX,
                        y: homeSettleY,
                        objectPosition: 'center center',
                        playbackRate: 1
                    });
                    finishHomeSettle();
                }
            });
        }
        
        if (revealHomeUi) {
            gsap.set('#center-nav', { pointerEvents: 'none' });
            gsap.to('#center-nav', {
                opacity: 1,
                duration: 0.74,
                delay: 0.22,
                ease: "sine.out",
                onComplete: () => {
                    if (isMobile) settleSectionsForHome();
                    gsap.set('#center-nav', { pointerEvents: 'auto' });
                    setHeroNavReady(true);
                    if (isMobile) showMobileHamburger();
                }
            });
            gsap.to(document.getElementById('status-label'), { opacity: 1, duration: 0.74, delay: 0.28, ease: "sine.out" });
        }
        
        // Restore custom cursor
        if (revealHomeUi) {
            setCustomCursorVisibility(true, 0.53);
        }
    }, true, false, reversePlaybackRate, (revealHomeUi && isContactReverse) ? CONTACT_EXTRO_EQUILIBRIUM_LEAD : (revealHomeUi ? 0.08 : (isMobile ? mobileReverseCompletionLead : reverseCompletionLead)), reverseHandoffOptions);

    if (!isServicesReverse && reverseSrc) {
        addManagedVideoListener('playing', '_managedPlayingHandler', () => {
            videoEl.playbackRate = reversePlaybackRate;
            if (isMobile && (!revealHomeUi || isContactReverse)) {
                scheduleChainedReverseEquilibriumTween();
            }
        }, true);
    }
}

// Global Brand Trigger
document.addEventListener('click', (e) => {
    if (e.target.closest('.brand-home-trigger')) {
        e.preventDefault();
        backToHome();
    }
});

// Meet The Team Functionality
document.addEventListener('click', (e) => {
    const meetTeamTrigger = e.target.closest('#meet-team-btn, .about-scroll-cue');
    if (!meetTeamTrigger) return;

    e.preventDefault();
    const inlineTeam = document.getElementById('about-team-inline');
    const aboutSection = document.getElementById('about-section');
    if (!inlineTeam || !aboutSection) return;

    hydrateLazyBackgrounds(inlineTeam);
    const maxScrollTop = Math.max(0, aboutSection.scrollHeight - aboutSection.clientHeight);
    const mobileTopOffset = isMobile ? 132 : 96;
    const targetTop = Math.min(maxScrollTop, Math.max(0, inlineTeam.offsetTop - mobileTopOffset));
    aboutSection.scrollTo({
        top: targetTop,
        behavior: prefersReducedMotionQuery.matches ? 'auto' : 'smooth'
    });
    requestAnimationFrame(updateAboutTeamVideoFocus);
});

const aboutScrollSection = document.getElementById('about-section');
if (aboutScrollSection) {
    aboutScrollSection.addEventListener('scroll', updateAboutTeamVideoFocus, { passive: true });
}
window.addEventListener('resize', updateAboutTeamVideoFocus);

function updateMobileContactFormFocus() {
    const contactSection = document.getElementById('contact-section');
    if (!contactSection || !isMobile || state !== 'contact' || !contactSection.classList.contains('active')) {
        document.body.classList.remove('contact-form-focus');
        return;
    }

    const threshold = Math.min(260, Math.max(150, window.innerHeight * 0.34));
    document.body.classList.toggle('contact-form-focus', contactSection.scrollTop > threshold);
}

const contactScrollSection = document.getElementById('contact-section');
if (contactScrollSection) {
    contactScrollSection.addEventListener('scroll', updateMobileContactFormFocus, { passive: true });
}
window.addEventListener('resize', updateMobileContactFormFocus);

document.addEventListener('click', (event) => {
    const cue = event.target.closest('.contact-form-cue');
    if (!cue) return;

    event.preventDefault();
    const contactSection = document.getElementById('contact-section');
    const formBlock = document.querySelector('#contact-section .contact-form-block');
    if (!contactSection || !formBlock) return;

    const targetTop = Math.max(0, formBlock.offsetTop - 34);
    contactSection.scrollTo({
        top: targetTop,
        behavior: prefersReducedMotionQuery.matches ? 'auto' : 'smooth'
    });
    document.body.classList.add('contact-form-focus');
});

window.addEventListener('hashchange', () => {
    if (window.location.hash === '#team' && state !== 'about') {
        clearTeamHash();
        return;
    }

    if (state !== 'about') return;

    if (window.location.hash === '#team') {
        openTeamExperience({ duration: 0.53, reset: false, syncHash: false });
        return;
    }

    if (isTeamSectionVisible()) {
        resetAboutView();
    }
});

// Team Member Interaction Logic
const teamData = {
    thaha: { name: "Muhammed Thaha Jasmine", role: "Chief Executive Officer", bio: "As CEO, MJ oversees creative direction and post-production strategy at Enso 8, ensuring that storytelling, technology, and execution move in sync. His leadership is rooted in a deep understanding of both narrative and technical timelines, allowing the studio to deliver complex projects with precision and clarity." },
    mr: { name: "M R Vishnuprasad", role: "Creative Director", bio: "An embodied fictionist. While most advertising begins with formats and finishes with messaging, Vishnu begins elsewhere: with writing, performance, and the physicality of ideas. He situates his practice at the intersection of making and meaning." },
    bharath: { name: "Bharath R", role: "Managing Director", bio: "Overseeing creative execution, client relationships, and end-to-end production delivery. With a background in filmmaking and post-production, he brings a structured, outcome-driven approach to ensuring every project meets both creative and commercial objectives." },
    amal: { name: "Amal Krishna", role: "Head of 3D Department", bio: "Leads the 3D Animation team at Enso8. He has over five yearsâ€™ experience leading the delivery of high-quality 3D animation projects across commercial and digital platforms." },
    nibu: { name: "Nibu Samuel", role: "2D Animator | Motion Graphics", bio: "A seasoned animator with over seventeen years of experience across character animation, motion graphics, and explainer-driven storytelling. He brings clarity, rhythm, and personality to visuals designed to inform, engage, and endure." },
    prince: { name: "Prince Dirron", role: "Chief Operations Officer", bio: "Oversees production workflows while actively contributing as a 3D artist. With a background rooted in problem-solving, visual execution, and marketing sensibility, he plays a key role in aligning creative ambition with operational efficiency." },
    athul_s: { name: "Athul Sudhakaran", role: "Editor", bio: "Video editor with over five years of professional experience delivering fast-paced, engaging content. His work is defined by strong rhythm, precise timing, and clear visual flow, with a particular strength in dynamic transitions and sharp, purposeful cuts." },
    nandagopan: { name: "Nandagopan P", role: "Sound Mixing Engineer", bio: "Sound designer and mixing engineer with six years of experience shaping cohesive soundscapes that support and strengthen narrative storytelling. He specialises in bringing together layers of sound into mixes that feel natural, immersive, and story-driven." },
    gokul: { name: "Gokul R Nadh", role: "Sound Designer", bio: "Sound designer with over five years of experience crafting immersive audio landscapes for films, branded content, and digital media. His work focuses on shaping atmosphere, emotion, and texture, using sound as a narrative tool that deepens the viewerâ€™s connection." },
    adith: { name: "Adith C Satheesh", role: "3D Generalist", bio: "3D Generalist with over five years of professional experience working on large-scale narrative and commercial productions. He specialises in photorealistic environments, lighting, and maintaining visual continuity across complex VFX pipelines." },
    sanjay: { name: "Sanjay S", role: "3D Generalist | Lighting/FX", bio: "Sanjay is a 3D generalist with over six years of experience crafting immersive digital visuals that balance technical precision with strong creative intent. He specialises in lighting, simulations, and visual effects, bringing concepts to life through detailed worlds that support narrative impact." },
    akhil: { name: "K O Akhil", role: "Senior Cinematographer", bio: "He has filmed enough to know that spectacle fades quickly. What remains is rhythm, continuity, and the strange intimacy between camera and subject. At Enso 8, he plays a central role in translating concepts into visual language that feels coherent." },
    akshay: { name: "Akshay K P", role: "Cinematographer", bio: "Accomplished cinematographer and media director with over a decade of experience crafting visually driven stories across commercials, branded content, live events, and narrative projects. His work seamlessly balances commercial impact with cinematic sensibility." },
    athul_p: { name: "Athul Prakash", role: "Colourist", bio: "Athul Prakash is a professional colourist with four years of experience shaping the visual language of films, commercials, and music videos. His work is driven by precise colour grading, refined contrast control, and a strong sensitivity to visual rhythm and tone." }
};

const teamMembers = document.querySelectorAll('.member');
const detailOverlay = document.getElementById('team-detail-overlay');
const closeBtn = document.querySelector('.detail-close-btn');

teamMembers.forEach(member => {
    member.addEventListener('click', () => {
        const key = member.getAttribute('data-member');
        const data = teamData[key];
        if (!data) return;

        document.getElementById('detail-name').innerText = data.name;
        document.getElementById('detail-role').innerText = data.role;
        document.getElementById('detail-bio').innerText = data.bio;
        
        const avatar = member.querySelector('.avatar');
        const bgImg = window.getComputedStyle(avatar).backgroundImage;
        const url = avatar?.dataset.bgLazy || bgImg.slice(4, -1).replace(/"/g, "");
        document.getElementById('detail-img').src = url;

        deactivateLocomotiveSection('team-section');
        detailOverlay.classList.add('active');
        setElementInteractivity(detailOverlay, true);
        gsap.from('.detail-info > *', { opacity: 0, y: 20, stagger: 0.03, duration: 0.33, ease: "power2.out" });
    });
});

window.openBlogArticle = function(articleId = 'what-ai-does-well') {
    const overlay = document.getElementById('blog-article-overlay');
    const panels = overlay ? overlay.querySelectorAll('.blog-article-panel') : [];
    const activePanel = overlay ? overlay.querySelector('.blog-article-panel[data-article="' + articleId + '"]') : null;
    if (!overlay || !panels.length) return;

    panels.forEach((panel) => {
        panel.style.display = panel === activePanel ? 'block' : 'none';
        panel.classList.toggle('active', panel === activePanel);
    });

    const targets = getBlogArticleAnimationTargets();
    isBlogArticleOverlayOpen = true;
    setElementInteractivity(overlay, true);
    gsap.killTweensOf(overlay);
    gsap.killTweensOf(targets);
    gsap.set(targets, { opacity: 0, y: 24 });
    gsap.to(overlay, { opacity: 1, duration: 0.42, ease: "power2.out" });
    gsap.to(targets, { opacity: 1, y: 0, duration: 0.46, stagger: 0.04, delay: 0.08, ease: "power3.out", clearProps: "transform" });
    deactivateLocomotiveSection('blogs-section');
    activateLocomotiveSection('blog-article-overlay', { reset: true });
};

window.closeBlogArticle = function(resumeUnderlying = true) {
    const overlay = document.getElementById('blog-article-overlay');
    const targets = getBlogArticleAnimationTargets();
    if (!overlay) return;
    isBlogArticleOverlayOpen = false;
    setElementInteractivity(overlay, false);
    gsap.killTweensOf(overlay);
    gsap.killTweensOf(targets);
    gsap.to(targets, {
        opacity: 0,
        y: 20,
        duration: 0.2,
        stagger: { each: 0.02, from: "start" },
        ease: "power2.in"
    });
    gsap.to(overlay, { opacity: 0, duration: 0.3, ease: "power2.in" });
    deactivateLocomotiveSection('blog-article-overlay', { reset: true });
    if (resumeUnderlying && state === 'blogs') {
        activateLocomotiveSection('blogs-section');
    }
};

function closeTeamDetailExperience() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove('active');
    setElementInteractivity(detailOverlay, false);
    gsap.to(detailOverlay, { opacity: 0, duration: 0.25, ease: "power2.in", onComplete: () => {
        detailOverlay.style.opacity = '';
    }});
    if (typeof isTeamSectionVisible === 'function' && isTeamSectionVisible()) {
        activateLocomotiveSection('team-section');
    }
}

if (closeBtn) {
    closeBtn.addEventListener('click', closeTeamDetailExperience);
}

if (detailOverlay) {
    detailOverlay.addEventListener('click', (event) => {
        if (event.target === detailOverlay) {
            closeTeamDetailExperience();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && detailOverlay.classList.contains('active')) {
            closeTeamDetailExperience();
        }
    });
}

// --- FRAGMENT ANIMATION ENGINE ---
class FragmentAnimation {
    constructor(canvasId, imageSrc) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.image = new Image();
        this.image.src = imageSrc;
        this.particles = [];
        this.isLoaded = false;
        
        this.image.onload = () => {
            this.isLoaded = true;
            this.initParticles();
        };

        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        this.canvas.width = 1000;
        this.canvas.height = 1000;
    }

    initParticles() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const size = 300;
        tempCanvas.width = size;
        tempCanvas.height = size;
        
        tempCtx.drawImage(this.image, 0, 0, size, size);
        const imageData = tempCtx.getImageData(0, 0, size, size).data;
        
        this.particles = [];
        const step = 4; // Particle density
        
        for (let y = 0; y < size; y += step) {
            for (let x = 0; x < size; x += step) {
                const index = (y * size + x) * 4;
                const alpha = imageData[index + 3];
                
                if (alpha > 128) {
                    this.particles.push({
                        x: x * 3 + 50, // Scale up and center
                        y: y * 3 + 50,
                        originX: x * 3 + 50,
                        originY: y * 3 + 50,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10,
                        size: Math.random() * 2 + 1,
                        color: `rgba(255, 255, 255, ${alpha / 255})`
                    });
                }
            }
        }
    }

    explode() {
        if (!this.isLoaded) return;
        gsap.to(this.particles, {
            x: (i, t) => t.x + (Math.random() - 0.5) * 800,
            y: (i, t) => t.y + (Math.random() - 0.5) * 800,
            opacity: 0,
            duration: 2.5,
            ease: "power4.out",
            stagger: { amount: 0.5, from: "center" }
        });
        this.animate();
    }

    assemble() {
        if (!this.isLoaded) return;
        this.particles.forEach(p => {
            p.x = p.originX + (Math.random() - 0.5) * 1000;
            p.y = p.originY + (Math.random() - 0.5) * 1000;
        });
        gsap.to(this.particles, {
            x: (i, t) => t.originX,
            y: (i, t) => t.originY,
            duration: 2,
            ease: "power3.out",
            stagger: { amount: 0.5, from: "center" }
        });
        this.animate();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        });
        if (gsap.isTweening(this.particles)) {
            requestAnimationFrame(() => this.animate());
        }
    }
}

const portfolioImageKeywords = {
    "Audi": "./portfolio-assets/audi-q8.svg",
    "Audi Q8": "./portfolio-assets/audi-q8.svg",
    "Nissan X-Trail": "./portfolio-assets/nissan.svg",
    "Nissan": "./portfolio-assets/nissan.svg",
    "Adidas": "./portfolio-assets/adidas.svg",
    "JBL": "./portfolio-assets/jbl.svg",
    "Etihad Airways": "./portfolio-assets/etihad-airways.svg",
    "Rolex": "./portfolio-assets/rolex.svg",
    "Emirates Airlines": "./portfolio-assets/emirates-airlines.svg",
    "Tata": "./portfolio-assets/tata.svg",
    "Damac": "./portfolio-assets/damac.svg",
    "Meraas": "./portfolio-assets/meraas.svg",
    "Department of Economy and Tourism Dubai": "./portfolio-assets/det-dubai.svg",
    "Department of Culture and Tourism Abu Dhabi": "./portfolio-assets/dct-abu-dhabi.svg",
    "Du": "./portfolio-assets/du.svg",
    "Mashreq": "./portfolio-assets/mashreq.svg",
    "Cultfit": "./portfolio-assets/cultfit.svg",
    "Clickon": "./portfolio-assets/clickon.svg",
    "Prestige": "./portfolio-assets/prestige.svg",
    "Infinix": "./portfolio-assets/infinix.svg"
};

const portfolioCaseStudies = {
    "nissan-xtrail": {
        brand: "Nissan",
        title: "Nissan X-Trail: Defy Ordinary",
        role: "Digital Imaging Technician workflow, 4K data pipeline, on-set color continuity",
        paragraphs: [
            `The Middle East launch of the All-New Nissan X-Trail demanded a narrative that bridged high-performance intelligent mobility with the emotional core of family life. The "Defy Ordinary" campaign treated advanced technology as a catalyst for wonder, transforming a routine family outing into a dreamlike journey through light and landscape.`,
            `Enso 8 led the Digital Imaging Technician workflow, operating as the critical link between camera capture and the final frame. Across domestic interiors and low-light desert night shoots, our priority was data integrity, visual consistency, and a reliable pipeline for high-fidelity 4K footage.`,
            `We protected the interplay between moonlight, vehicle optics, and glowing light sculptures so the visual language stayed fluid and cinematic. By bridging on-set capture and post-production, Enso 8 enabled a streamlined handoff into VFX while grounding the vehicle's futuristic features in tangible reality.`
        ]
    },
    "damac-islands": {
        brand: "DAMAC",
        title: "DAMAC Islands: Island State of Mind",
        role: "Digital Imaging Technician workflow, real-time color monitoring, 4K data management",
        paragraphs: [
            `The "Island State of Mind" campaign captures DAMAC Islands as a private island paradise, moving from the rhythm of the city into a calm, sun-soaked sanctuary. Morning yoga, crystal lagoons, surfing, and elegant evenings under the stars position the destination as a permanent escape.`,
            `Enso 8 led the DIT workflow, keeping the visual experience consistently premium across bright beaches, golden sunsets, and vibrant night scenes. We managed the full 4K data pipeline and provided real-time on-set color monitoring so the creative vision could be reviewed and refined instantly.`,
            `From the shimmer of water to architectural textures and natural skin tones, every detail was protected for a polished, high-end visual narrative that reflects the luxury and lifestyle of DAMAC Islands while supporting an efficient post-production process.`
        ]
    },
    "etihad-flawless": {
        brand: "Etihad Airways",
        title: "Etihad Airways: Mission Flawless Welcome",
        role: "Digital Imaging Technician workflow, data integrity, real-time color management",
        paragraphs: [
            `The "Mission Flawless Welcome" campaign reimagines hospitality as a high-stakes cinematic mission. Built as a high-octane collaboration with the Mission Impossible franchise, it transforms cabin crew preparation into a precision operation where every detail matters.`,
            `Enso 8 led the DIT workflow, ensuring a seamless visual integration between the bold, high-contrast language of the film franchise and Etihad's refined brand identity. Across metallic textures, deep shadows, and dynamic movement, we maintained visual consistency and data integrity.`,
            `Our team managed the 4K pipeline with precision, balancing cinematic intensity with the softness and clarity of the luxury cabin environment. Real-time color management and quality control gave the creative team instant feedback, helping every frame land with clarity and intent.`
        ]
    },
    "etihad-punctual": {
        brand: "Etihad Airways",
        title: "Etihad Airways: Mission Reliably Punctual",
        role: "Digital Imaging Technician workflow, exposure control, multi-environment consistency",
        paragraphs: [
            `While "Flawless Welcome" highlighted cabin elegance, "Mission Reliably Punctual" focuses on the coordination of aviation logistics. Pilots, ground handlers, and engineers are framed like an elite spy team, with every check and engine ignition building toward an on-schedule departure.`,
            `Enso 8 approached the DIT workflow with a focus on environmental contrast and technical resilience. Filming moved from dim, instrument-lit cockpit scenes to the intense brightness of the desert tarmac, each requiring careful exposure discipline.`,
            `We kept highlights controlled, shadows detailed, and aircraft surfaces, control panels, and high-visibility crew elements crisp across every scene. By managing the 4K pipeline across multiple operational environments, we unified the film's industrial realism with its cinematic ambition.`
        ]
    },
    "du-network": {
        brand: "du",
        title: "du Network: The Network That Gets You",
        role: "4K data pipeline, on-set quality control, color management",
        paragraphs: [
            `The "Network That Gets You" campaign is a vibrant celebration of connectivity across the UAE, positioning digital infrastructure as the invisible thread binding a diverse society together. The film moves from street performance and family entertainment to e-sports, business, and celebration.`,
            `Enso 8 maintained visual harmony and data integrity across the campaign's fast-moving vignettes. We managed the high-fidelity 4K pipeline, preserving vibrant street textures, sharp 5G interface details, and the cinematic scale of the UAE skyline.`,
            `On set, our real-time quality control and color management helped the creative team see how each moment would merge into a cohesive brand story. The result was a seamless transition into post-production without technical compromise.`
        ]
    },
    "rolex-hannah": {
        brand: "Rolex",
        title: "Rolex Presents: Hannah Mills - Making Waves",
        role: "Multi-format DIT workflow, metadata management, color science",
        paragraphs: [
            `Rolex's "Making Waves" campaign featuring Hannah Mills explores high-performance sailing and the personal evolution of an elite athlete. The film balances Mills' record-breaking Olympic career with her journey as a mother and advocate for women in sport.`,
            `Enso 8 managed a complex multi-format DIT workflow that bridged contemporary high-resolution cinematography with legacy archival media. We oversaw high dynamic range footage, specialty action cameras, and low-resolution personal archives through rigorous metadata management.`,
            `Our color science work preserved an emotional through line between domestic intimacy and competitive intensity. In unpredictable maritime environments, we protected the integrity of sun-flared coastal scenes and high-contrast racing sequences so the campaign retained cinematic depth.`
        ]
    },
    "infinix-quick": {
        brand: "Infinix",
        title: "Infinix Note 40 Series: Quick Charge, Quicker Success",
        role: "Narrative post-production, motion graphics, live action and UI integration",
        paragraphs: [
            `For the Note 40 Series launch, Infinix needed to position charging capability as a strategic asset for the modern professional. The challenge was to turn All-Round FastCharge 2.0 into a high-stakes narrative for a fast-paced corporate audience.`,
            `Enso 8 built the edit around a rhythmic, energy-driven structure that mirrors the speed of the technology. Dynamic motion graphics and sharp transitions highlighted 70W Wired FastCharge and 20W Wireless MagCharge without interrupting the story.`,
            `A ticking clock motif and stylized battery UI heightened the tension as the protagonist moved from low-battery anxiety to a confident pitch and promotion. The final film turns a functional feature into a clear brand advantage.`
        ]
    },
    "infinix-power": {
        brand: "Infinix",
        title: "Infinix Note 40 Series: Power Up, Live Free",
        role: "Narrative post-production, sports pacing, digital UI overlays",
        paragraphs: [
            `The second phase of the Note 40 Series launch shifted the charging narrative from the boardroom to the competitive arena. The campaign visualizes Magnetic Charging Experience accessories like MagPower and MagCase as tools that help a hero flip the script.`,
            `As lead editors, Enso 8 built a high-energy structure that mirrors professional sports intensity. Precise rhythmic pacing synchronized the protagonist's focus with the tactile snap of the magnetic power bank.`,
            `By integrating vibrant digital UI overlays into live action footage, we highlighted All-Round FastCharge 2.0 while preserving the momentum of the cricket narrative. The final edit turns instant connectivity into a moment of peak performance.`
        ]
    },
    "audi-new-chapter": {
        brand: "Audi",
        title: "Audi: Embrace a New Chapter",
        role: "Live streaming, spot editing, on-set client feedback workflow",
        paragraphs: [
            `The Audi Q8 Sportback e-tron launch campaign is a cinematic meditation on progress and new beginnings. Featuring Elaine Welteroth, the narrative connects the intellectual depth of a library with the high-performance energy of the city.`,
            `Enso 8 acted as the technical heartbeat of the set, managing a live streaming and spot editing workflow that created a frictionless feedback loop between production and client. Across architectural interiors and highway sequences, we maintained a high-definition live feed for instant remote oversight.`,
            `By spot editing footage on the fly, we allowed the creative team to see a rough-cut approximation of the final vision while still on set. This enabled immediate adjustments and helped the final output preserve global-standard cinematic texture.`
        ]
    },
    "damac-riverside-envy": {
        brand: "DAMAC",
        title: "DAMAC Riverside Views: The Art of Envy",
        role: "Online editing, conform, broadcast-ready finishing",
        paragraphs: [
            `The "Noisy Neighbour" campaign for DAMAC Riverside Views takes a witty, observational approach to luxury. Through the eyes of a nosy neighbour, it contrasts ordinary domestic life with an aspirational world of infinity pools, padel courts, smart interiors, and lifestyle detail.`,
            `Enso 8 served as Online Editor and Conformist, acting as the final architect of the high-resolution finish. We aligned high-fidelity 4K footage with the creative edit while maintaining technical precision across transitions and visual effect overlays.`,
            `Our finishing work protected the visual integrity of luxury reveal sequences, from sun-drenched pool vistas to crisp architectural textures. The final master delivered the sophisticated allure expected of a premium DAMAC campaign.`
        ]
    },
    "damac-riverside-anonymous": {
        brand: "DAMAC",
        title: "DAMAC Riverside Views: Non-DAMAC Anonymous",
        role: "Conform, online editing, final visual polish",
        paragraphs: [
            `The "Non-DAMAC Anonymous" campaign uses satire to explore the struggles of life outside the DAMAC ecosystem. In a support group setting, characters share humorous grievances that make the desire for a DAMAC lifestyle feel inevitable.`,
            `Enso 8 handled the conform and online edit, ensuring the campaign's comedic timing was matched by technical precision in the final master. We integrated live action sequences with the high-fidelity digital reveal of the DAMAC Riverside Views mobile interface.`,
            `Our work focused on visual polish, color consistency, and texture refinement, especially in the shift from the muted support group environment to vibrant, high-contrast renders of the new development.`
        ]
    },
    "central-park-plaza": {
        brand: "Meraas",
        title: "Central Park Plaza: Urban Energy Meets Exclusive Luxury",
        role: "Spot editing, real-time production feedback, continuity verification",
        paragraphs: [
            `Central Park Plaza required a campaign that captured the relationship between lush natural environments and the energy of Dubai's urban core. The narrative moves from skyline grandeur to tactile lifestyle details, positioning the development as a sanctuary where city vibrancy meets private park tranquility.`,
            `Enso 8 executed the role of Spot Editor, serving as the creative bridge between the live set and the final vision. Through a real-time editing workflow, we enabled an instant feedback loop for the client and director across pools, tennis courts, private interiors, and skyline vistas.`,
            `By assembling rough cuts on the fly, we helped verify narrative momentum and visual continuity before the production moved on. This gave the team confidence that each luxury reveal and lifestyle beat aligned with the brand's global standard.`
        ]
    },
    "visit-ready-winter": {
        brand: "Visit Abu Dhabi",
        title: "Visit Abu Dhabi: All Ready for Winter",
        role: "Spot editing, performance timing, multi-location continuity",
        paragraphs: [
            `The "All Ready for Winter" campaign is a high-speed journey through Abu Dhabi's cultural and entertainment destinations. Centered on two friends, it moves from Louvre Abu Dhabi to SeaWorld and The Galleria with a sense of spontaneous wonder.`,
            `Enso 8 worked as Spot Editor, providing an instant feedback loop for the director and client. This allowed comedic timing, character dynamics, and chase-sequence energy to be refined while the team was still on location.`,
            `Our real-time workflow helped maintain continuity across drastically different environments, from controlled gallery lighting to unpredictable marine park water spray. The result balanced performance, polish, and tourism-scale spectacle.`
        ]
    },
    "visit-best-packed": {
        brand: "Visit Abu Dhabi",
        title: "Visit Abu Dhabi: The Best-Packed Winter",
        role: "Spot editing, VFX timing verification, multi-landmark continuity",
        paragraphs: [
            `The "Best-Packed Winter" campaign explores luxury through magical realism, following a protagonist whose wardrobe assembles itself into outfits that mirror Abu Dhabi's many experiences. The film moves from architectural calm to SeaWorld and Qasr Al Watan grandeur.`,
            `Enso 8 served as Spot Editor, creating a real-time feedback loop for the director and VFX team. This was critical for wardrobe flight sequences where physical performance and intended digital overlays had to be checked precisely before moving locations.`,
            `By spot editing key sequences across high-profile landmarks, we helped the production maintain narrative momentum and a high-fidelity aesthetic throughout the campaign.`
        ]
    },
    "visit-cant-wait": {
        brand: "Visit Abu Dhabi",
        title: "Visit Abu Dhabi: Can't Wait to Winter",
        role: "Spot editing, live action and VFX flow, client review workflow",
        paragraphs: [
            `The "Can't Wait to Winter" campaign captures the anticipation of a family holiday in Abu Dhabi. A playful magical-realism device sends wardrobes into motion, guiding a family through Louvre Abu Dhabi, desert sandboarding, SeaWorld, Warner Bros. World, and the coastline.`,
            `Enso 8 acted as the technical bridge between live action sets and the final cinematic vision. Our spot editing workflow gave the director and client immediate review across multiple high-profile locations.`,
            `We verified narrative flow and the precise timing needed for magical realism sequences before each location move. This helped keep the campaign seamless across regal interiors, theme park energy, desert action, and coastal calm.`
        ]
    },
    "dubai-tourism": {
        brand: "Dubai Tourism",
        title: "Dubai Tourism: Ultimate Travel Hack",
        role: "Conform, high-resolution master assembly, VFX plate integration",
        paragraphs: [
            `The "Ultimate Travel Hack" campaign for Dubai Tourism was designed for the Japanese market, using magical realism to showcase the emirate's range. Two travelers in a quiet cafe are suddenly transported into Dubai by a mysterious guide.`,
            `Enso 8 served as Conformist, acting as the final architect of the high-resolution master. We assembled live action plates with complex visual effects so teleportation sequences felt seamless and immediate.`,
            `Our work protected material texture and color consistency across domestic interiors, Al Fahidi, desert buggy action, Burj Al Arab, and Palm Jumeirah. The final output met the quality standards required for a global tourism launch.`
        ]
    },
    "french-avenue-safari": {
        brand: "French Avenue",
        title: "French Avenue: Safari Breeze",
        role: "3D animation, fluid dynamics, cinematic world-building",
        paragraphs: [
            `Fragrance is inherently abstract, experienced through memory, mood, and emotion rather than form. For Safari Breeze, our goal was to visualise the invisible: translating scent profiles into immersive cinematic worlds through material storytelling, fluid dynamics, and atmospheric design.`,
            `Safari Breeze is a fragrance defined by contrast â€” warmth and freshness, intensity and freedom. To visualise the fragrance profile, we introduced a dynamic collision of elements: cascading orange citrus, vibrant green botanicals, and deep red berries. These components interact through fluid simulations, building momentum before converging to form the bottle itself.`,
            `As the narrative unfolds, the environment transitions from shadowed macro close-ups into a lush, sun-drenched jungle, expanding the world and reinforcing the "Safari" spirit of exploration and vitality.`
        ]
    },
    "french-avenue-jasmere": {
        brand: "French Avenue",
        title: "French Avenue: Jasmere",
        role: "3D animation, minimalist cinematic direction, atmospheric design",
        paragraphs: [
            `This film was created by Enso 8 for French Avenue as part of an ongoing series of fragrance campaigns, following Safari Breeze. Building on the visual language established in earlier films, this project explores a refined, cinematic approach to translating scent into mood, movement, and atmosphere.`,
            `Jasmere called for restraint, softness, and precision. The story centers on the slow blooming of a single white jasmine bud, symbolising purity and refined femininity. Every movement is deliberate, designed to feel weightless and controlled. The bottle is revealed within a dreamlike desert-at-dusk environment, where soft, directional lighting highlights gold accents and polished surfaces.`,
            `The atmosphere remains quiet and ethereal, allowing the product to feel elevated and timeless. The final film presents Jasmere as a fragrance of understated luxury: sensory, intimate, and elegant, demonstrating Enso 8's ability to craft high-end beauty visuals through subtlety and precision.`
        ]
    },
    "jbl-tour-one-m3": {
        brand: "JBL",
        title: "JBL Tour One M3: First Doesn't Follow",
        role: "3D animation, liquid-metal simulations, live-action integration, post-production",
        paragraphs: [
            `The "First Doesn't Follow" campaign for JBL required a visual language that felt both premium and high-energy. Our objective was to create a rhythmic, fast-paced narrative highlighting the technical superiority of the Tour One M3 headphones â€” specifically focusing on sound purity, noise cancellation, and the innovative Smart TX features.`,
            `We opened the film with liquid-metal simulations and fluid dynamics to represent the "Pro Sound" quality, using metallic textures that mirror the sleek finish of the headphones. We designed an intricate 3D breakdown of the Spatial 360 Head Tracking and Smart TX interface, making complex wireless streaming technology feel intuitive and visually arresting.`,
            `Working with Burp Production, we integrated high-quality live-action shots of the product in use, transitioning from CG environments to a minimalist real-world studio setting to showcase the True Adaptive Noise Cancellation in a relatable context. The final commercial positions the JBL Tour One M3 as a leader in the audio space, highlighting Enso 8's ability to direct large-scale collaborations and deliver a global-standard aesthetic for world-class electronics brands.`
        ]
    },
    "clikon-washing-machine": {
        brand: "Clikon",
        title: "Clikon AI-Powered Washing Machine",
        role: "3D animation, exploded-view animation, end-to-end product film direction",
        paragraphs: [
            `For the Clikon AI-Powered Washing Machine, Enso 8 set out to transform a familiar household appliance into a refined expression of intelligence and engineering. Leading the project end-to-end, we crafted a cinematic product film that moves beyond surface aesthetics to reveal the unseen technology driving precision laundry care.`,
            `The narrative opens with abstract liquid-light reflections gliding across the machine's sleek exterior, gradually resolving into the Smart Touch Control Panel and establishing a premium, tech-forward tone. To communicate the power of Direct Motion Technology, we developed a detailed exploded-view animation of the motor assembly, using high-fidelity metallic textures and controlled motion to emphasise durability, efficiency, and mechanical precision.`,
            `The final film translates complex appliance engineering into a clear, visually arresting brand story, positioning Clikon as a premium, future-ready innovator in home technology.`
        ]
    },
    "cultfit-massager-02": {
        brand: "Cult.fit",
        title: "Cult.fit Massager Gun: Break the Stone",
        role: "3D animation, procedural fracturing simulation, conceptual storytelling",
        paragraphs: [
            `To introduce the Cult Gun Massager, the brief went beyond product demonstration â€” it asked for a visceral expression of relief. The creative idea centered on transforming muscle stiffness into a tangible antagonist: a mechanical, stone-like human form embodying extreme tension and pain. Enso 8 developed a custom procedural fracturing setup to simulate stone armor breaking on contact.`,
            `Each impact from the massager triggers controlled cracks and collapses, turning relief into a visually felt event. The film transitions beneath the surface to reveal a deep-tissue view, where the silicone head's rhythmic motion dissolves stiffness at a muscular level. This technical moment grounds the metaphor in physical reality.`,
            `Break the Stone transforms muscle recovery into a powerful visual metaphor: making relief immediate, physical, and unmistakable. The film demonstrates Enso 8's ability to combine procedural simulation with conceptual storytelling for high-impact product launches. Animation was executed by Enso 8, with concept, screenplay, and direction by 24fps Talkies.`
        ]
    },
    "cultfit-massager-01": {
        brand: "Cult.fit",
        title: "Cult.fit Massager Gun: Get Moving Again",
        role: "Character animation, transformation effects, CG and live-action integration",
        paragraphs: [
            `While Break the Stone leans into abstraction, Get Moving Again brings the idea of muscle recovery into everyday life. Set in a high-energy gym locker room, the film follows an athlete whose post-workout soreness makes even simple movement feel impossible.`,
            `We animated the athlete with stone-like encrustations layered onto the body, visually expressing the weight, restriction, and frustration of sore muscles. As the Cult Gun Massager is applied, the stone surface crumbles away in a fluid transition, revealing the real actor beneath. This transformation bridges animation and live-action, symbolising immediate recovery and restored mobility.`,
            `Get Moving Again grounds recovery in relatability: showing how quickly pain gives way to movement. The film highlights Enso 8's strength in character animation, transformation effects, and integrating CG seamlessly into real-world environments. Enso 8 led animation production, in collaboration with 24fps Talkies on concept, screenplay, and direction.`
        ]
    },
    "adidas-cultfit": {
        brand: "Adidas Ã— Cult.fit",
        title: "Adidas Ã— Cult.fit: Adidas Strength+ Campaign",
        role: "Animation, post-production, motion graphics, large-scale brand film",
        paragraphs: [
            `To announce the launch of Adidas Strength+ classes across more than 150 Cult.fit centers in India, the campaign needed to feel fast, powerful, and aspirational. Working alongside the creative direction of 24fps Talkies, Enso 8 led animation and post-production to craft a high-impact film capturing the intensity and discipline of professional strength training.`,
            `The edit is driven by momentum. Fast-cut transitions, stylised glitch effects, and punchy visual accents mirror elevated heart rates, explosive movement, and the mental focus of high-performance workouts. Every visual beat was meticulously synchronised to a driving, percussive soundtrack â€” aligning animation, sound, and athlete movement from heavy lifts to dynamic jumps.`,
            `Motion graphics and digital overlays, including Adidas Strength+ branding and interactive "Book Your Class Now" UI elements, were designed to feel embedded within the gym environment rather than layered on top. The final spot bridges Adidas's performance-driven legacy with Cult.fit's modern fitness culture, showcasing Enso 8's ability to deliver precision-driven animation and post-production for large-scale, multi-brand campaigns.`
        ]
    },
    "kappa-culture": {
        brand: "Kappa",
        title: "Kappa Cultr: Festival Awakening",
        role: "Concept, 3D animation, environment design, full production pipeline",
        paragraphs: [
            `For the Kappa Cultr Festival, Enso 8 set out to create more than an announcement film â€” we built a myth. The vision was to bridge nature and future technology through a single, unforgettable moment: the awakening of culture itself. The film centers on a monumental, retro-futuristic mechanical deity emerging from a forest landscape, transforming the environment into a high-energy festival arena.`,
            `We developed the concept and screenplay around a symbolic seed of culture â€” a glowing cube that descends into a dark forest. Its arrival triggers a chain reaction, culminating in the emergence of a colossal robotic entity and the activation of the festival world. The central figure was designed as a hybrid of industrial machinery and retro television aesthetics, with a screen-based head displaying the CULTR identity, creating a bold ownable mascot anchored in both nostalgia and futurism.`,
            `Dense forest environments and low-light, magic-hour rendering heighten contrast, allowing neon lasers, glowing surfaces, and digital elements to cut dramatically through the scene. Lighting became a storytelling tool, guiding the transition from mystery to spectacle. By owning the entire pipeline from concept to final render, Enso 8 demonstrated its strength in delivering high-concept brand films that combine narrative ambition, technical execution, and cultural impact.`
        ]
    },
    "clikon-ironbox": {
        brand: "Clikon",
        title: "Clikon Super Heavy Weight Smart Iron",
        role: "3D animation, environment design, sand simulation, product film",
        paragraphs: [
            `For the launch of the Clikon Super Heavy Weight Smart Iron, Enso 8 set out to visualise power, durability, and performance at an epic scale. Rather than placing the product in a conventional home environment, we crafted a cinematic narrative set within a vast desert landscape, using scale and terrain as metaphors for strength, resistance, and unstoppable performance.`,
            `The film introduces the iron emerging from a shipping container like an industrial machine, cutting decisively through desert dunes. High-detail environment modeling and dynamic sand simulations convey mass, friction, and momentum â€” allowing the product's "super heavy weight" quality to be felt rather than stated. Precision lighting and surface reflections highlight the heated plate, anti-rust build, and ergonomic industrial design, reinforcing a sense of robustness and premium finish.`,
            `The narrative resolves by transitioning from the harsh desert environment to a lifestyle payoff â€” perfectly pressed garments displayed on a billboard â€” bridging extreme power with everyday usability. By leading the project from concept to final render, Enso 8 transformed a household appliance into a high-performance visual statement, turning a functional USP into a compelling brand story.`
        ]
    },
    "prestige-hexamagic": {
        brand: "Prestige",
        title: "Prestige Triply HexaMagic Cookware",
        role: "3D visualisation, material rendering, technical product storytelling",
        paragraphs: [
            `For Prestige's Triply HexaMagic cookware, the challenge wasn't visibility â€” it was comprehension. The product's true advantage lives in engineering details too small to photograph, yet critical to performance. Working with 24fps Talkies, Enso 8 developed a high-fidelity 3D visualisation revealing the science behind the HexaMagic honeycomb structure, explaining durability, non-stick performance, and metal-spoon safety through motion.`,
            `This macro-scale visualisation demonstrates how the raised steel network protects the non-stick coating from friction and wear, making the benefit immediately intuitive. The Triply construction was broken down layer by layer â€” revealing a 304 food-grade stainless steel cooking surface, a heavy-gauge aluminum core for uniform heat distribution, and a 430 stainless steel outer layer optimised for induction cooking.`,
            `Hyper-realistic metallic textures and controlled lighting emphasise the cookware's precision engineering and refined finish, reinforcing Prestige's premium positioning. The result is a polished, high-impact product visualisation that showcases Enso 8's ability to translate complex technology into persuasive brand storytelling for industry leaders.`
        ]
    },
    "protein-chef": {
        brand: "Protein Chef",
        title: "Protein Chef: Bread Superheroes",
        role: "3D character animation, brand storytelling, e-commerce integration",
        paragraphs: [
            `In collaboration with 24fps Talkies, Enso 8 brought the Protein Chef bread range to life using dynamic 3D character animation, transforming each product variant into a superhero with a distinct personality and purpose. In a saturated health-food category, Protein Chef set out to make an everyday essential feel extraordinary.`,
            `We designed a league of "Bread Superheroes," each visually expressing its nutritional benefit. From the spear-wielding Brown Bread to the haloed Multigrain hero, every character carried unique silhouettes, props, and attitudes â€” making health benefits instantly legible and memorable.`,
            `Character animation was seamlessly integrated with a simulated e-commerce interface, guiding viewers from product discovery to a "protein-boosted" checkout. The result blended entertainment with clarity, mirroring the actual consumer journey and elevating the brand from functional staple to a character-driven experience.`
        ]
    }
};

const portfolioGridCaseMeta = [
    { caseId: "audi-new-chapter", title: "Audi: Embrace a New Chapter" },
    { caseId: "etihad-flawless", title: "Etihad Airways: Mission Flawless Welcome" },
    { caseId: "etihad-punctual", title: "Etihad Airways: Mission Reliably Punctual" },
    { caseId: "rolex-hannah", title: "Rolex Presents: Hannah Mills - Making Waves" },
    { caseId: "visit-ready-winter", title: "Visit Abu Dhabi: All Ready for Winter" },
    { caseId: "french-avenue-jasmere", title: "French Avenue: Jasmere" },
    { caseId: "nissan-xtrail", title: "Nissan X-Trail: Defy Ordinary" },
    { caseId: "dubai-tourism", title: "Dubai Tourism: Ultimate Travel Hack" },
    { caseId: "damac-islands", title: "DAMAC Islands: Island State of Mind" },
    { caseId: "french-avenue-safari", title: "French Avenue: Safari Breeze" },
    { caseId: "jbl-tour-one-m3", title: "JBL: Tour One M3" },
    { caseId: "adidas-cultfit", title: "Adidas x Cultfit" },
    { caseId: "cultfit-massager-01", title: "Cultfit Massager 01" },
    { caseId: "cultfit-massager-02", title: "Cultfit Massager 02" },
    { caseId: "infinix-quick", title: "Infinix Note 40 Series: Quick Charge, Quicker Success" },
    { caseId: "central-park-plaza", title: "Central Park Plaza: Urban Energy Meets Exclusive Luxury" },
    { caseId: "damac-riverside-anonymous", title: "DAMAC Riverside Views: Non-DAMAC Anonymous" },
    { caseId: "du-network", title: "du Network: The Network That Gets You" },
    { caseId: "clikon-washing-machine", title: "Clikon Washing Machine" },
    { caseId: "clikon-ironbox", title: "Clikon Ironbox" },
    { caseId: "prestige-hexamagic", title: "Prestige Cookware: Triply HexaMagic" },
    { caseId: "kappa-culture", title: "Kappa Culture" },
    { title: "Fleuriche: French Avenue 4K" },
    { title: "TATA Soulful" }
];

let isPortfolioParallaxBound = false;
let isPortfolioPlaybackBound = false;
let portfolioPlaybackRaf = null;
let activePortfolioSelectedMedia = null;
const PORTFOLIO_AHEAD_PLAY_COUNT = 5;
const PORTFOLIO_PRELOAD_BATCH_COUNT = 24;
// portfolioWarmupStarted is declared at the top of the file to avoid temporal dead zone

function getPortfolioImageUrl(title, item, index = 0) {
    const normalizedTitle = String(title || '').trim().toLowerCase();
    const matchedKey = Object.keys(portfolioImageKeywords)
        .sort((a, b) => b.length - a.length)
        .find(key => {
            const normalizedKey = key.toLowerCase();
            return normalizedTitle === normalizedKey || normalizedTitle.includes(normalizedKey);
        });
    if (matchedKey) return portfolioImageKeywords[matchedKey];

    return "./portfolio-assets/audi-q8.svg";
}

function attachPortfolioImage(item, title, index) {
    const media = item.querySelector('.portfolio-media');
    if (!media || !title) return null;

    const imageUrl = getPortfolioImageUrl(title, item, index);
    let fallbackImage = media.querySelector('.portfolio-image');

    if (!fallbackImage) {
        fallbackImage = document.createElement('img');
        fallbackImage.className = 'portfolio-image';
        fallbackImage.loading = 'lazy';
        fallbackImage.decoding = 'async';
        fallbackImage.alt = `${title} portfolio visual`;
        media.insertBefore(fallbackImage, media.firstChild);
    }

    let overlay = media.querySelector('.portfolio-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'portfolio-overlay';
        overlay.innerHTML = '<div class="portfolio-info"><h3 class="project-title"></h3></div>';
        media.appendChild(overlay);
    }

    const titleEl = overlay.querySelector('.project-title');
    if (titleEl) titleEl.textContent = title;

    fallbackImage.src = imageUrl;
    return imageUrl;
}

function getPortfolioFallbackCase(meta = {}) {
    const title = meta.title || 'Selected Work';
    return {
        brand: title.split(':')[0],
        title,
        role: 'Selected portfolio film',
        paragraphs: [
            'Full case-study notes for this project are being prepared. The video remains available to preview in the portfolio grid.'
        ]
    };
}

function getPortfolioCaseStudy(caseId, meta = {}) {
    return portfolioCaseStudies[caseId] || getPortfolioFallbackCase(meta);
}

function ensurePortfolioCaseModal() {
    let modal = document.getElementById('portfolio-case-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'portfolio-case-modal';
    modal.className = 'portfolio-case-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="portfolio-case-modal__scrim" data-portfolio-case-close></div>
        <article class="portfolio-case-modal__panel" role="dialog" aria-modal="true" aria-labelledby="portfolio-case-title">
            <button class="portfolio-case-modal__close" type="button" aria-label="Close case study" data-portfolio-case-close>&times;</button>
            <div class="portfolio-case-modal__media" data-portfolio-case-media></div>
            <div class="portfolio-case-modal__details">
                <aside class="portfolio-case-modal__meta">
                    <span class="portfolio-case-modal__eyebrow" data-portfolio-case-brand></span>
                    <h2 class="portfolio-case-modal__title" id="portfolio-case-title" data-portfolio-case-title></h2>
                    <div class="portfolio-case-modal__role" data-portfolio-case-role></div>
                </aside>
                <div class="portfolio-case-modal__body" data-portfolio-case-body></div>
            </div>
        </article>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-portfolio-case-close]')) {
            closePortfolioCaseStudy();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-open')) {
            closePortfolioCaseStudy();
        }
    });

	    return modal;
	}

function resetSelectedPortfolioMedia() {
    if (!activePortfolioSelectedMedia) return;

    try { activePortfolioSelectedMedia.pause?.(); } catch(e) {}
    try { activePortfolioSelectedMedia.currentTime = 0; } catch(e) {}
    activePortfolioSelectedMedia = null;

    document.querySelectorAll('.portfolio-item.is-selected').forEach((item) => {
        item.classList.remove('is-selected');
    });
}

function playSelectedPortfolioMedia(opener, modal) {
    const mediaHost = modal?.querySelector('[data-portfolio-case-media]');
    const sourcePlayer = opener?.querySelector('.portfolio-video');
    const playbackId = sourcePlayer?.getAttribute('playback-id') || getPortfolioPlaybackId(opener);

    resetSelectedPortfolioMedia();
    if (!mediaHost || !playbackId) {
        if (mediaHost) mediaHost.innerHTML = '';
        return;
    }

    mediaHost.innerHTML = '';
    opener?.classList.add('is-selected');

    const selectedPlayer = document.createElement('mux-player');
    selectedPlayer.className = 'portfolio-case-modal__player';
    selectedPlayer.setAttribute('playback-id', playbackId);
    selectedPlayer.setAttribute('stream-type', 'on-demand');
    selectedPlayer.setAttribute('playsinline', '');
    selectedPlayer.setAttribute('preload', 'auto');
    selectedPlayer.setAttribute('autoplay', 'any');
    selectedPlayer.setAttribute('controls', '');
    selectedPlayer.removeAttribute('muted');
    selectedPlayer.muted = false;
    selectedPlayer.loop = false;
    selectedPlayer.volume = 1;
    mediaHost.appendChild(selectedPlayer);
    activePortfolioSelectedMedia = selectedPlayer;

    const playAttempt = selectedPlayer.play?.();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {
            selectedPlayer.setAttribute('controls', '');
        });
    }
}

function closePortfolioCaseStudy() {
    const modal = document.getElementById('portfolio-case-modal');
    if (!modal) return;

	    modal.classList.remove('is-open');
	    modal.setAttribute('aria-hidden', 'true');
	    document.body.classList.remove('portfolio-case-open');
	    resetSelectedPortfolioMedia();
	    const mediaHost = modal.querySelector('[data-portfolio-case-media]');
	    if (mediaHost) mediaHost.innerHTML = '';
	    requestPortfolioPlaybackSync();

    const portfolioSection = document.getElementById('portfolios-section');
    if (portfolioSection && modal.dataset.previousPortfolioOverflowY !== undefined) {
        portfolioSection.style.overflowY = modal.dataset.previousPortfolioOverflowY;
        delete modal.dataset.previousPortfolioOverflowY;
    }

    const focusSelector = modal.dataset.lastFocusSelector;
    if (focusSelector) {
        document.querySelector(focusSelector)?.focus({ preventScroll: true });
        delete modal.dataset.lastFocusSelector;
    }
}

function openPortfolioCaseStudy(caseId, meta = {}, opener = null) {
    const modal = ensurePortfolioCaseModal();
    const caseStudy = getPortfolioCaseStudy(caseId, meta);
    const brandEl = modal.querySelector('[data-portfolio-case-brand]');
    const titleEl = modal.querySelector('[data-portfolio-case-title]');
    const roleEl = modal.querySelector('[data-portfolio-case-role]');
    const bodyEl = modal.querySelector('[data-portfolio-case-body]');

    if (brandEl) brandEl.textContent = caseStudy.brand || '';
    if (titleEl) titleEl.textContent = caseStudy.title || '';
    if (roleEl) roleEl.textContent = caseStudy.role || '';
    if (bodyEl) {
        bodyEl.innerHTML = '';
        (caseStudy.paragraphs || []).forEach((paragraph) => {
            const paragraphEl = document.createElement('p');
            paragraphEl.textContent = paragraph;
            bodyEl.appendChild(paragraphEl);
        });
        bodyEl.scrollTop = 0;
    }

	    pausePortfolioVideos();
	    playSelectedPortfolioMedia(opener, modal);

    const portfolioSection = document.getElementById('portfolios-section');
    if (portfolioSection && modal.dataset.previousPortfolioOverflowY === undefined) {
        modal.dataset.previousPortfolioOverflowY = portfolioSection.style.overflowY || '';
        portfolioSection.style.overflowY = 'hidden';
    }

    if (opener?.dataset?.portfolioIndex) {
        modal.dataset.lastFocusSelector = `.portfolio-item[data-portfolio-index="${opener.dataset.portfolioIndex}"]`;
    }

    document.body.classList.add('portfolio-case-open');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
        modal.querySelector('.portfolio-case-modal__close')?.focus({ preventScroll: true });
    });
}

function markPortfolioVideoUnavailable(item, video) {
    item.classList.add('video-unavailable');
    item.classList.remove('has-video-mounted');
    item.classList.remove('is-playing');
    getPortfolioVideoShell(item)?.classList.remove('is-mounted');
    if (video) {
        try { video.pause(); } catch(e) {}
        video.setAttribute('aria-hidden', 'true');
    }
}

function getPortfolioVideoShell(item) {
    return item?.querySelector('.portfolio-video-shell') || null;
}

function getPortfolioPlaybackId(item) {
    if (!item) return '';

    const existingVideo = item.querySelector('mux-player.portfolio-video');
    return item.dataset.playbackId ||
        getPortfolioVideoShell(item)?.dataset.playbackId ||
        existingVideo?.getAttribute('playback-id') ||
        '';
}

function configurePortfolioVideo(video) {
    if (!video) return;

    video.removeAttribute('autoplay');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.muted = true;
    video.loop = true;
}

function mountPortfolioVideo(item) {
    if (!item || item.classList.contains('video-unavailable')) return null;
    if (!window.customElements?.get('mux-player')) return null;

    const shell = getPortfolioVideoShell(item);
    const playbackId = getPortfolioPlaybackId(item);
    if (!shell || !playbackId) return null;

    let video = shell.querySelector('mux-player.portfolio-video');
    if (video) return video;

    video = document.createElement('mux-player');
    video.className = 'portfolio-video';
    video.setAttribute('playback-id', playbackId);
    video.setAttribute('stream-type', 'on-demand');
    video.setAttribute('nohotkeys', '');
    video.setAttribute('aria-hidden', 'true');

    const handleUnavailable = () => markPortfolioVideoUnavailable(item, video);
    video.addEventListener('error', handleUnavailable);
    video.addEventListener('loadedmetadata', requestPortfolioPlaybackSync);
    video.addEventListener('canplay', requestPortfolioPlaybackSync);

    configurePortfolioVideo(video);
    shell.appendChild(video);
    shell.classList.add('is-mounted');
    item.classList.add('has-video-mounted');

    return video;
}

function pausePortfolioVideo(item, video) {
    if (!item || !video) return;

    item.classList.remove('is-playing');
    video.removeAttribute('autoplay');
    video.setAttribute('preload', 'auto');
    try { video.pause?.(); } catch(e) {}
}

function unmountPortfolioVideo(item) {
    const shell = getPortfolioVideoShell(item);
    const video = shell?.querySelector('mux-player.portfolio-video');
    if (!shell || !video) return;

    pausePortfolioVideo(item, video);
    shell.classList.remove('is-mounted');
    item.classList.remove('has-video-mounted');
    video.remove();
}

function unmountPortfolioVideos() {
    document.querySelectorAll('#portfolios-section .portfolio-item').forEach(unmountPortfolioVideo);
    portfolioWarmupStarted = false;
}

function pausePortfolioVideos() {
    document.querySelectorAll('#portfolios-section .portfolio-video, #portfolios-section mux-player.bg-fill').forEach((video) => {
        const owner = video.closest('.portfolio-item, .portfolio-hero-full, .portfolio-footer-full') || video;
        pausePortfolioVideo(owner, video);
    });
}

function isPortfolioPlaybackAllowed() {
    const section = document.getElementById('portfolios-section');
    return Boolean(
        section &&
        section.classList.contains('active') &&
        getComputedStyle(section).visibility !== 'hidden' &&
        !document.body.classList.contains('portfolio-case-open')
    );
}

function isPortfolioItemInPlaybackWindow(item) {
    const rect = item.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const margin = Math.max(220, viewportHeight * 0.35);

    return (
        rect.bottom >= -margin &&
        rect.top <= viewportHeight + margin &&
        rect.right >= -120 &&
        rect.left <= viewportWidth + 120
    );
}

function isPortfolioItemNearPlaybackWindow(item) {
    const rect = item.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const margin = Math.max(900, viewportHeight * 1.6);

    return rect.bottom >= -margin && rect.top <= viewportHeight + margin;
}

function warmPortfolioGridVideos({ limit = PORTFOLIO_PRELOAD_BATCH_COUNT } = {}) {
    if (!window.customElements?.get('mux-player')) return;

    const items = Array.from(document.querySelectorAll('#portfolios-section .portfolio-item'))
        .filter(item => !item.classList.contains('video-unavailable'))
        .slice(0, limit);

    items.forEach((item, index) => {
        setTimeout(() => {
            const video = mountPortfolioVideo(item);
            if (!video) return;
            configurePortfolioVideo(video);
            try { video.load?.(); } catch (_) {}
        }, index * 90);
    });
}

function schedulePortfolioWarmup({ force = false } = {}) {
    if (portfolioWarmupStarted && !force) return;
    portfolioWarmupStarted = true;

    ensureMuxPlayerLoaded().then(() => {
        if (typeof initPortfolioSystem === 'function') {
            initPortfolioSystem();
        }
        warmPortfolioGridVideos();
        requestPortfolioPlaybackSync();
    }).catch(() => {});
}

function playPortfolioVideo(item, video) {
    if (!item || !video || item.classList.contains('video-unavailable')) return;

    video.removeAttribute('aria-hidden');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('preload', 'auto');
    video.muted = true;
    video.loop = true;
    item.classList.add('is-playing');

    const playAttempt = video.play?.();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {
            setTimeout(() => {
                if (isPortfolioPlaybackAllowed() && isPortfolioItemInPlaybackWindow(item) && !item.classList.contains('video-unavailable')) {
                    video.play?.().catch?.(() => {});
                }
            }, 450);
        });
    }
}

function getPortfolioPlaybackPlan(items) {
    const playIndexes = new Set();
    let highestVisibleIndex = -1;

    items.forEach((item, index) => {
        if (isPortfolioItemInPlaybackWindow(item)) {
            playIndexes.add(index);
            highestVisibleIndex = Math.max(highestVisibleIndex, index);
        }
    });

    const aheadStart = highestVisibleIndex >= 0 ? highestVisibleIndex + 1 : 0;
    const aheadEnd = Math.min(items.length - 1, aheadStart + PORTFOLIO_AHEAD_PLAY_COUNT - 1);
    for (let index = aheadStart; index <= aheadEnd; index += 1) {
        playIndexes.add(index);
    }

    return playIndexes;
}

function syncPortfolioVideoPlayback() {
    const canPlay = isPortfolioPlaybackAllowed();
    const portfolioItems = Array.from(document.querySelectorAll('.portfolio-item'));
    const playIndexes = canPlay ? getPortfolioPlaybackPlan(portfolioItems) : new Set();

    portfolioItems.forEach((item, index) => {
        const shouldPlay = canPlay && playIndexes.has(index);
        let video = item.querySelector('mux-player.portfolio-video');

        if (shouldPlay) {
            video = video || mountPortfolioVideo(item);
            if (video) playPortfolioVideo(item, video);
            return;
        }

        if (video) {
            pausePortfolioVideo(item, video);
        }
    });

    document.querySelectorAll('#portfolios-section mux-player.bg-fill').forEach((video) => {
        const owner = video.closest('.portfolio-hero-full, .portfolio-footer-full') || video;
        if (canPlay && isPortfolioItemInPlaybackWindow(owner)) {
            playPortfolioVideo(owner, video);
        } else {
            pausePortfolioVideo(owner, video);
        }
    });
}

function requestPortfolioPlaybackSync() {
    if (portfolioPlaybackRaf !== null) return;

    portfolioPlaybackRaf = requestAnimationFrame(() => {
        portfolioPlaybackRaf = null;
        syncPortfolioVideoPlayback();
    });
}

function bindPortfolioPlaybackEvents() {
    if (isPortfolioPlaybackBound) return;
    const portfolioSection = document.getElementById('portfolios-section');

    portfolioSection?.addEventListener('scroll', requestPortfolioPlaybackSync, { passive: true });
    window.addEventListener('resize', requestPortfolioPlaybackSync);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pausePortfolioVideos();
        } else {
            requestPortfolioPlaybackSync();
        }
    });

    isPortfolioPlaybackBound = true;
}
let portfolioHoverLabel = null;

function ensurePortfolioHoverLabel() {
    if (portfolioHoverLabel) return portfolioHoverLabel;
    portfolioHoverLabel = document.createElement('div');
    portfolioHoverLabel.className = 'portfolio-hover-label';
    portfolioHoverLabel.setAttribute('aria-hidden', 'true');
    document.body.appendChild(portfolioHoverLabel);
    return portfolioHoverLabel;
}

function positionPortfolioHoverLabel(clientX, clientY) {
    if (!portfolioHoverLabel) return;
    const offsetX = 18;
    const offsetY = 26;
    portfolioHoverLabel.style.left = `${clientX + offsetX}px`;
    portfolioHoverLabel.style.top = `${clientY + offsetY}px`;
}

function showPortfolioHoverLabel(text, clientX, clientY) {
    if (isMobile || !text) return;
    const label = ensurePortfolioHoverLabel();
    label.textContent = text;
    positionPortfolioHoverLabel(clientX, clientY);
    label.classList.add('is-visible');
}

function hidePortfolioHoverLabel() {
    if (!portfolioHoverLabel) return;
    portfolioHoverLabel.classList.remove('is-visible');
}

// --- PORTFOLIO INTERACTION ENGINE ---
function initPortfolioSystem() {
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    bindPortfolioPlaybackEvents();

    document.querySelectorAll('#portfolios-section mux-player.bg-fill').forEach(configurePortfolioVideo);
    
    portfolioItems.forEach((item, index) => {
        const meta = portfolioGridCaseMeta[index] || {};
        const existingVideo = item.querySelector('mux-player.portfolio-video');
        const title = meta.title || item.querySelector('.project-title')?.textContent.trim() || `Portfolio Film ${index + 1}`;
        item.dataset.portfolioIndex = String(index);
        item.dataset.projectTitle = title;
        if (meta.caseId) item.dataset.caseId = meta.caseId;
        const playbackId = getPortfolioPlaybackId(item);
        if (playbackId) item.dataset.playbackId = playbackId;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `Open case study: ${title}`);

        attachPortfolioImage(item, title, index + 1);

        if (item.dataset.portfolioReady === 'true') return;
        item.dataset.portfolioReady = 'true';

        if (existingVideo) {
            const handleUnavailable = () => markPortfolioVideoUnavailable(item, existingVideo);
            existingVideo.addEventListener('error', handleUnavailable);
            configurePortfolioVideo(existingVideo);
            existingVideo.addEventListener('loadedmetadata', requestPortfolioPlaybackSync);
            existingVideo.addEventListener('canplay', requestPortfolioPlaybackSync);
        }

        let touchStart = null;
        let suppressTapUntil = 0;

        item.addEventListener('touchstart', (event) => {
            const touch = event.touches?.[0];
            if (!touch) return;
            touchStart = {
                x: touch.clientX,
                y: touch.clientY,
                moved: false
            };
        }, { passive: true });

        item.addEventListener('touchmove', (event) => {
            if (!touchStart) return;
            const touch = event.touches?.[0];
            if (!touch) return;
            const dx = touch.clientX - touchStart.x;
            const dy = touch.clientY - touchStart.y;
            if (Math.hypot(dx, dy) > 10) {
                touchStart.moved = true;
                suppressTapUntil = performance.now() + 450;
            }
        }, { passive: true });

        item.addEventListener('touchend', () => {
            if (touchStart?.moved) {
                suppressTapUntil = performance.now() + 450;
            }
            touchStart = null;
        }, { passive: true });

        item.addEventListener('touchcancel', () => {
            suppressTapUntil = performance.now() + 450;
            touchStart = null;
        }, { passive: true });

        item.addEventListener('click', (event) => {
            if (performance.now() < suppressTapUntil) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            openPortfolioCaseStudy(item.dataset.caseId, meta, item);
        });

        item.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openPortfolioCaseStudy(item.dataset.caseId, meta, item);
        });

    });

    requestPortfolioPlaybackSync();

    // Keep portfolio browsing stable; avoid creating many transform tweens on pointer movement.
    if (!PORTFOLIO_CURSOR_PARALLAX_ENABLED) {
        isPortfolioParallaxBound = true;
        return;
    }

    // Parallax Grid Movement
    if (!isPortfolioParallaxBound) {
        window.addEventListener('mousemove', (e) => {
            if (state !== 'portfolios') return;
            
            const moveX = (e.clientX / window.innerWidth - 0.5) * 2;
            const moveY = (e.clientY / window.innerHeight - 0.5) * 2;
            
            portfolioItems.forEach(item => {
                const factor = parseFloat(item.getAttribute('data-parallax')) || 0.05;
                gsap.to(item, {
                    x: moveX * factor * 54,
                    y: moveY * factor * 36,
                    duration: 1.8,
                    ease: "sine.out"
                });
            });
        });
        isPortfolioParallaxBound = true;
    }
}

// Update startVideoTransition for Portfolios + mobile nav handling
const originalStartVideoTransition = startVideoTransition;
startVideoTransition = function(pageId) {
    warmPageResources(pageId);
    warmTransitionAudio(pageId);
    if (!transitionAudioSources[pageId]) stopTransitionAudio();

    if (isAnimating) {
        queueSectionTransition(pageId);
        if (isMobile) {
            lockMobileComposition();
            document.body.classList.remove('show-mobile-nav', 'mobile-home-nav');
            if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'true');
            hideMobileHamburger();
        }
        return;
    }

    if (isMobile) {
        lockMobileComposition();
        const navIsOpen = document.body.classList.contains('show-mobile-nav');
        document.body.classList.remove('mobile-home-nav', 'intro-active');
        if (navIsOpen) document.body.classList.remove('show-mobile-nav');
        if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'true');
        hideMobileHamburger();
    }

    if (shouldRouteSectionTransitionThroughHome(pageId)) {
        routeSectionTransitionThroughHome(pageId);
        return;
    }

    if (transitionAudioSources[pageId] && state !== pageId) {
        playTransitionAudio(pageId);
    }

    originalStartVideoTransition(pageId);

    if (pageId === 'portfolios') {
        ensureMuxPlayerLoaded().then(() => {
            initPortfolioSystem();
        }).catch(() => {});
    }

    if (isMobile) {
        setTimeout(() => {
            const inSection = !['scatter', 'intro', 'stabilize', 'mobile-landing', 'mobile-nav'].includes(state);
            if (inSection) {
                showMobileHamburger();
            }
        }, 900);
    }
};

window.addEventListener('resize', () => {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;

    if (isMobile) {
        lockMobileComposition({ force: !wasMobile });
        return;
    }

    if (wasMobile) {
        releaseMobileCompositionLock();
        leaveMobileHomeState();
        hideMobileHamburger();
        if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'true');
        gsap.set(videoEl, { opacity: 1 });
    }

    Object.keys(locomotiveRegistry).forEach((sectionId) => {
        updateLocomotiveSection(sectionId);
    });
});

// â”€â”€ MOBILE HAMBURGER MENU â”€â”€
if (mobileHamburger) {
    mobileHamburger.addEventListener('click', () => {
        if (!isMobile) return;
        lockMobileComposition();
        prepareMobileNavFade({ home: false });
        document.body.classList.add('show-mobile-nav');
        document.body.classList.remove('mobile-home-nav');
        if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'false');
        hideMobileHamburger();
        fadeMobileNavIn({ home: false });
        suspendAllLocomotiveSections();
    });
}

if (mobileNavClose) {
    mobileNavClose.addEventListener('click', () => {
        if (!isMobile) return;
        lockMobileComposition();
        fadeMobileNavOut(() => {
            const inSection = !['scatter', 'intro', 'stabilize', 'mobile-landing', 'mobile-nav'].includes(state);
            if (inSection) {
                showMobileHamburger();
                resumeCurrentScrollableSection();
            } else if (state === 'mobile-nav') {
                prepareMobileNavFade({ home: true });
                document.body.classList.add('show-mobile-nav', 'mobile-home-nav');
                if (mobileNavOverlay) mobileNavOverlay.setAttribute('aria-hidden', 'false');
                hideMobileHamburger();
                fadeMobileNavIn({ home: true });
            }
        });
    });
}
