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

// Fix 1: routeSection reverseEndTransform (line 1236)
applyFix('routeSection reverseEndTransform',
    /scale: getPrimaryVideoScale\(isMobile \? getMobileCinematicScaleForPage\('about'\) : 1\),/,
    "scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage('about') : DESKTOP_SECTION_HOME_RETURN_SCALE),"
);

// Fix 2: lockContactVideoComposition (line 1341)
applyFix('lockContactVideoComposition',
    /contactVideoState\.scale = isMobile \? getMobileCinematicScaleForPage\('contact'\) : 1;/,
    "contactVideoState.scale = isMobile ? getMobileCinematicScaleForPage('contact') : DESKTOP_SECTION_HOME_RETURN_SCALE;"
);

// Fix 3: setContactVideoForegroundMode (line 1394)
applyFix('setContactVideoForegroundMode',
    /gsap\.set\(videoEl, { x: 0, y: '0vh', scale: isMobile \? getMobileUniformCinematicScale\(\) : 1, clearProps: 'filter' }\);/,
    "gsap.set(videoEl, { x: 0, y: '0vh', scale: isMobile ? getMobileUniformCinematicScale() : DESKTOP_SECTION_HOME_RETURN_SCALE, clearProps: 'filter' });"
);

// Fix 4: currentReverseTransform (line 3791)
applyFix('currentReverseTransform',
    /scale: getPrimaryVideoScale\(isMobile \? getMobileCinematicScaleForPage\(reversePageId\) : 1\),/,
    "scale: getPrimaryVideoScale(isMobile ? getMobileCinematicScaleForPage(reversePageId) : DESKTOP_SECTION_HOME_RETURN_SCALE),"
);

// Fix 5: defaultHomeSettleScale (line 3797)
applyFix('defaultHomeSettleScale',
    /const defaultHomeSettleScale = revealHomeUi[\s\r\n]+\? getRevealHomeVideoScale\(reverseSrc\)[\s\r\n]+: \(isMobile \? getMobileUniformCinematicScale\(\) : HOME_EQUILIBRIUM_SCALE\);/s,
    'const defaultHomeSettleScale = revealHomeUi\\n        ? getRevealHomeVideoScale(reverseSrc)\\n        : (isMobile ? getMobileUniformCinematicScale() : DESKTOP_SECTION_HOME_RETURN_SCALE);'
);

fs.writeFileSync('main-v2.js', code, 'utf8');
console.log('\\nAll done. File saved.');
