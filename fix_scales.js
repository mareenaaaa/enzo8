const fs = require('fs');
let code = fs.readFileSync('main-v2.js', 'utf8');

function applyFix(label, searchRe, replacement) {
    const before = code;
    code = code.replace(searchRe, replacement);
    if (code === before) {
        console.error('FAILED: ' + label);
    } else {
        console.log('OK: ' + label);
    }
}

// 1. DESKTOP_HOME_LOGO_DISPLAY_SCALE -> 0.60
applyFix('DESKTOP_HOME_LOGO_DISPLAY_SCALE',
    /const DESKTOP_HOME_LOGO_DISPLAY_SCALE\s*=\s*[^;]+;/,
    'const DESKTOP_HOME_LOGO_DISPLAY_SCALE = 0.60;'
);

// 2. INTRO_ZOOM_START_SCALE -> DESKTOP_HOME_LOGO_DISPLAY_SCALE
applyFix('INTRO_ZOOM_START_SCALE',
    /const INTRO_ZOOM_START_SCALE\s*=\s*[^;]+;/,
    'const INTRO_ZOOM_START_SCALE = DESKTOP_HOME_LOGO_DISPLAY_SCALE;'
);

// 3. INTRO_ZOOM_END_SCALE -> DESKTOP_HOME_LOGO_DISPLAY_SCALE
applyFix('INTRO_ZOOM_END_SCALE',
    /const INTRO_ZOOM_END_SCALE\s*=\s*[^;]+;/,
    'const INTRO_ZOOM_END_SCALE = DESKTOP_HOME_LOGO_DISPLAY_SCALE;'
);

// 4. setContactVideoForegroundMode reset: scale 1 -> getHomeLogoDisplayScale()
applyFix('setContactVideoForegroundMode scale',
    /scale: isMobile \? getMobileUniformCinematicScale\(\) : 1, clearProps: 'filter'/,
    "scale: isMobile ? getMobileUniformCinematicScale() : getHomeLogoDisplayScale(), clearProps: 'filter'"
);

// 5. lockContactVideoComposition: scale 1 -> getHomeLogoDisplayScale()
applyFix('lockContactVideoComposition scale',
    /contactVideoState\.scale = isMobile \? getMobileCinematicScaleForPage\('contact'\) : 1;/,
    "contactVideoState.scale = isMobile ? getMobileCinematicScaleForPage('contact') : getHomeLogoDisplayScale();"
);

// 6. getRevealHomeVideoScale: DESKTOP_SECTION_HOME_RETURN_SCALE -> getHomeLogoDisplayScale()
applyFix('getRevealHomeVideoScale',
    /return reverseSrc \? DESKTOP_SECTION_HOME_RETURN_SCALE : getHomeLogoDisplayScale\(\);/,
    'return getHomeLogoDisplayScale();'
);

// 7. introEquilibriumScale: HOME_EQUILIBRIUM_SCALE -> getHomeLogoDisplayScale()
applyFix('introEquilibriumScale HOME_EQUILIBRIUM_SCALE',
    /: \(isSeamlessIntroHandoff \? visibleSeamlessEquilibriumScale : HOME_EQUILIBRIUM_SCALE\)\)/,
    ': (isSeamlessIntroHandoff ? visibleSeamlessEquilibriumScale : getHomeLogoDisplayScale()))'
);

// 8. introEquilibriumScale else: SECTION_CHAIN_HOME_SCALE -> getHomeLogoDisplayScale()
applyFix('introEquilibriumScale SECTION_CHAIN_HOME_SCALE',
    /: \(isMobile \? mobileTargetScale : SECTION_CHAIN_HOME_SCALE\);(\s*const introStartScale)/,
    ': (isMobile ? mobileTargetScale : getHomeLogoDisplayScale());$1'
);

// 9. homeSectionIntroStartScale: DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE -> getHomeLogoDisplayScale()
applyFix('homeSectionIntroStartScale',
    /: \(isMobile \? getHomeLogoDisplayScale\(\) : DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE\)/,
    ': (isMobile ? getHomeLogoDisplayScale() : getHomeLogoDisplayScale())'
);

// 10. visibleHomeHandoffScale: HOME_EQUILIBRIUM_SCALE -> getHomeLogoDisplayScale()
applyFix('visibleHomeHandoffScale',
    /: \(isMobile \? mobileTargetScale : HOME_EQUILIBRIUM_SCALE\);(\s*const forwardVideoSrc)/,
    ': (isMobile ? mobileTargetScale : getHomeLogoDisplayScale());$1'
);

// 11. visibleSeamlessEquilibriumScale: SECTION_CHAIN_HOME_SCALE -> getHomeLogoDisplayScale()
applyFix('visibleSeamlessEquilibriumScale',
    /const visibleSeamlessEquilibriumScale = seamlessIntroTransform\?\.scale \?\? SECTION_CHAIN_HOME_SCALE;/,
    'const visibleSeamlessEquilibriumScale = seamlessIntroTransform?.scale ?? getHomeLogoDisplayScale();'
);

// 12. routeSectionTransitionThroughHome about reverseEndTransform fallback: 1 -> getHomeLogoDisplayScale()
applyFix('routeSection about reverseEndTransform',
    /scale: getPrimaryVideoScale\(isMobile \? getMobileCinematicScaleForPage\('about'\) : 1\),([\s\r\n]+x: Number\(gsap\.getProperty\(videoEl, 'x'\)\))/,
    "scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage('about') : getHomeLogoDisplayScale()),$1x: Number(gsap.getProperty(videoEl, 'x'))"
);

// 13. executeFinalReverse currentReverseTransform fallback: 1 -> getHomeLogoDisplayScale()
applyFix('executeFinalReverse currentReverseTransform fallback',
    /scale: getPrimaryVideoScale\(isMobile \? getMobileCinematicScaleForPage\(reversePageId\) : 1\),([\s\r\n]+x: Number\(gsap\.getProperty\(videoEl, 'x'\)\))/,
    "scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage(reversePageId) : getHomeLogoDisplayScale()),$1"
);

// 14. defaultHomeSettleScale chain: HOME_EQUILIBRIUM_SCALE -> getHomeLogoDisplayScale()
applyFix('defaultHomeSettleScale chain',
    /: \(isMobile \? getMobileUniformCinematicScale\(\) : HOME_EQUILIBRIUM_SCALE\);([\s\r\n]+const mobileHomeReturnTransform)/,
    ': (isMobile ? getMobileUniformCinematicScale() : getHomeLogoDisplayScale());$1'
);

// 15. Add desktopHomeReturnTransform and update resolvedReverseEndTransform
applyFix('desktopHomeReturnTransform + resolvedReverseEndTransform',
    /(const mobileHomeReturnTransform = \(isMobile && revealHomeUi && isAboutReverse\)\s*\? \{ scale: defaultHomeSettleScale, x: 0, y: "0vh" \}\s*: null;\s*)(const resolvedReverseEndTransform = reverseEndTransform\s*\|\|\s*\(isContactReverse\s*\?\s*\(mobileHomeReturnTransform \|\| \{ scale: getContactHandoffScale\(\), x: 0, y: 0 \}\)\s*:\s*\(isAboutReverse \? \(mobileHomeReturnTransform \|\| currentReverseTransform\) : equilibriumTransform\)\);)/,
    `$1// Desktop: animate the reverse to the home display scale BEFORE committing the frozen
    // home frame, giving a smooth size change instead of an abrupt crossfade jump.
    const desktopHomeReturnTransform = (!isMobile && revealHomeUi && (isAboutReverse || isContactReverse))
        ? { scale: defaultHomeSettleScale, x: 0, y: "0vh" }
        : null;
    const resolvedReverseEndTransform = reverseEndTransform
        || (isContactReverse
            ? (mobileHomeReturnTransform || desktopHomeReturnTransform || { scale: getContactHandoffScale(), x: 0, y: 0 })
            : (isAboutReverse ? (mobileHomeReturnTransform || desktopHomeReturnTransform || currentReverseTransform) : equilibriumTransform));`
);

// 16. revealServicesReverse: SECTION_CHAIN_HOME_SCALE -> 1 (full screen for visual continuity)
applyFix('revealServicesReverse scale to 1',
    /const servicesReverseScale = isMobile \? getMobileServicesMediaScale\(\) : SECTION_CHAIN_HOME_SCALE;/,
    '// Services reverse starts at full screen (1.0) for visual continuity from the services section.\n        // scheduleChainedReverseEquilibriumTween() handles the scale-down for chain transitions.\n        // For direct home return, the gsap.to in playVideo onComplete settles to getHomeLogoDisplayScale().\n        const servicesReverseScale = isMobile ? getMobileServicesMediaScale() : 1;'
);

fs.writeFileSync('main-v2.js', code, 'utf8');
console.log('\nAll done. File saved.');
