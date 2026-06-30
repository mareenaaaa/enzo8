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

// 1. getRevealHomeVideoScale
applyFix('getRevealHomeVideoScale',
    /return getHomeLogoDisplayScale\(\);/,
    'return reverseSrc ? DESKTOP_SECTION_HOME_RETURN_SCALE : DESKTOP_SECTION_HOME_RETURN_SCALE;'
);

// 2. getRuntimeHomeEquilibriumTransform
applyFix('getRuntimeHomeEquilibriumTransform',
    /scale: getHomeLogoDisplayScale\(\),([\s\r\n]+x: 0,[\s\r\n]+y: '0vh')/,
    "scale: isMobile ? getHomeLogoDisplayScale() : DESKTOP_SECTION_HOME_RETURN_SCALE,$1"
);

// 3. getVisibleHomeSourceScale
applyFix('getVisibleHomeSourceScale',
    /return getPrimaryVideoScale\(getHomeLogoDisplayScale\(\)\);/,
    'return getPrimaryVideoScale(DESKTOP_SECTION_HOME_RETURN_SCALE);'
);

// 4. introEquilibriumScale (line 2889 and 2890)
applyFix('introEquilibriumScale',
    /: \(isSeamlessIntroHandoff \? visibleSeamlessEquilibriumScale : getHomeLogoDisplayScale\(\)\)\)\s*: \(isMobile \? mobileTargetScale : getHomeLogoDisplayScale\(\)\);/s,
    ': (isSeamlessIntroHandoff ? visibleSeamlessEquilibriumScale : DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE))\\n        : (isMobile ? mobileTargetScale : DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE);'
);

// 5. homeSectionIntroStartScale
applyFix('homeSectionIntroStartScale',
    /const homeSectionIntroStartScale = \(shouldScaleIntroFromVisibleHome \|\| shouldScaleServicesFromVisibleHome\)\s*\? getHomeLogoDisplayScale\(\)/,
    'const homeSectionIntroStartScale = (shouldScaleIntroFromVisibleHome || shouldScaleServicesFromVisibleHome)\\n        ? (isMobile ? getHomeLogoDisplayScale() : DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE)'
);

// 6. visibleHomeHandoffScale
applyFix('visibleHomeHandoffScale',
    /: \(isMobile \? mobileTargetScale : getHomeLogoDisplayScale\(\)\);\s*const forwardVideoSrc/s,
    ': (isMobile ? mobileTargetScale : DESKTOP_SECTION_HOME_RETURN_SCALE);\\n    const forwardVideoSrc'
);

// 7. visibleSeamlessEquilibriumScale
applyFix('visibleSeamlessEquilibriumScale',
    /const visibleSeamlessEquilibriumScale = seamlessIntroTransform\?\.scale \?\? getHomeLogoDisplayScale\(\);/,
    'const visibleSeamlessEquilibriumScale = seamlessIntroTransform?.scale ?? DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE;'
);

// 8. routeSection about reverseEndTransform
applyFix('routeSection about reverseEndTransform',
    /scale: getPrimaryVideoScale\(isMobile \? getMobileCinematicScaleForPage\('about'\) : getHomeLogoDisplayScale\(\)\),/,
    "scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage('about') : DESKTOP_SECTION_HOME_RETURN_SCALE),"
);

// 9. executeFinalReverse currentReverseTransform
applyFix('executeFinalReverse currentReverseTransform',
    /scale: getPrimaryVideoScale\(isMobile \? getMobileCinematicScaleForPage\(reversePageId\) : getHomeLogoDisplayScale\(\)\),/,
    "scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage(reversePageId) : DESKTOP_SECTION_HOME_RETURN_SCALE),"
);

// 10. defaultHomeSettleScale
applyFix('defaultHomeSettleScale',
    /const defaultHomeSettleScale = revealHomeUi\s*\? getRevealHomeVideoScale\(reverseSrc\)\s*: \(isMobile \? getMobileUniformCinematicScale\(\) : getHomeLogoDisplayScale\(\)\);/s,
    'const defaultHomeSettleScale = revealHomeUi\\n        ? getRevealHomeVideoScale(reverseSrc)\\n        : (isMobile ? getMobileUniformCinematicScale() : DESKTOP_SECTION_HOME_RETURN_SCALE);'
);

// 11. animatePortfolioLogoExit startScale
applyFix('animatePortfolioLogoExit startScale',
    /const startScale = getPrimaryVideoScale\(isMobile \? getMobileUniformCinematicScale\(\) : getHomeLogoDisplayScale\(\)\);/,
    'const startScale = getPrimaryVideoScale(isMobile ? getMobileUniformCinematicScale() : DESKTOP_SECTION_HOME_RETURN_SCALE);'
);

// 12. setContactVideoForegroundMode reset scale
applyFix('setContactVideoForegroundMode scale',
    /scale: isMobile \? getMobileUniformCinematicScale\(\) : getHomeLogoDisplayScale\(\), clearProps: 'filter'/,
    "scale: isMobile ? getMobileUniformCinematicScale() : DESKTOP_SECTION_HOME_RETURN_SCALE, clearProps: 'filter'"
);

// 13. lockContactVideoComposition
applyFix('lockContactVideoComposition scale',
    /contactVideoState\.scale = isMobile \? getMobileCinematicScaleForPage\('contact'\) : getHomeLogoDisplayScale\(\);/,
    "contactVideoState.scale = isMobile ? getMobileCinematicScaleForPage('contact') : DESKTOP_SECTION_HOME_RETURN_SCALE;"
);

fs.writeFileSync('main-v2.js', code, 'utf8');
console.log('\\nAll done. File saved.');
