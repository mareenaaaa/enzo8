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

// 1. Change HOME_EQUILIBRIUM_SCALE to 0.60
applyFix('HOME_EQUILIBRIUM_SCALE',
    /const HOME_EQUILIBRIUM_SCALE = 0\.32;/,
    'const HOME_EQUILIBRIUM_SCALE = 0.60;'
);

// 2. Remove zoom from INTRO_ZOOM_START_SCALE
applyFix('INTRO_ZOOM_START_SCALE',
    /const INTRO_ZOOM_START_SCALE = 0\.33;/,
    'const INTRO_ZOOM_START_SCALE = HOME_EQUILIBRIUM_SCALE;'
);

// 3. Fix getRuntimeHomeEquilibriumTransform from 1 to DESKTOP_SECTION_HOME_RETURN_SCALE
applyFix('getRuntimeHomeEquilibriumTransform',
    /scale: isMobile \? getHomeLogoDisplayScale\(\) : 1,([\s\r\n]+x: 0,[\s\r\n]+y: '0vh')/,
    "scale: isMobile ? getHomeLogoDisplayScale() : DESKTOP_SECTION_HOME_RETURN_SCALE,$1"
);

// 4. Fix getVisibleHomeSourceScale from HOME_EQUILIBRIUM_SCALE to DESKTOP_SECTION_HOME_RETURN_SCALE
applyFix('getVisibleHomeSourceScale',
    /return getPrimaryVideoScale\(HOME_EQUILIBRIUM_SCALE\);/,
    'return getPrimaryVideoScale(DESKTOP_SECTION_HOME_RETURN_SCALE);'
);

// 5. Fix animatePortfolioLogoExit from HOME_EQUILIBRIUM_SCALE to DESKTOP_SECTION_HOME_RETURN_SCALE
applyFix('animatePortfolioLogoExit',
    /const startScale = getPrimaryVideoScale\(isMobile \? getMobileUniformCinematicScale\(\) : HOME_EQUILIBRIUM_SCALE\);/,
    'const startScale = getPrimaryVideoScale(isMobile ? getMobileUniformCinematicScale() : DESKTOP_SECTION_HOME_RETURN_SCALE);'
);

// 6. Fix introEquilibriumScale on line 2889 from HOME_EQUILIBRIUM_SCALE to DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE
applyFix('introEquilibriumScale',
    /: \(isSeamlessIntroHandoff \? visibleSeamlessEquilibriumScale : HOME_EQUILIBRIUM_SCALE\)\)\s*: \(isMobile \? mobileTargetScale : SECTION_CHAIN_HOME_SCALE\);/s,
    ': (isSeamlessIntroHandoff ? visibleSeamlessEquilibriumScale : DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE))\\n        : (isMobile ? mobileTargetScale : DESKTOP_HOME_TO_SECTION_INTRO_START_SCALE);'
);

// 7. Fix defaultHomeSettleScale fallback for desktop from getHomeLogoDisplayScale() to DESKTOP_SECTION_HOME_RETURN_SCALE
// In 8fe84eb, defaultHomeSettleScale is:
// const defaultHomeSettleScale = revealHomeUi ? getRevealHomeVideoScale(reverseSrc) : (isMobile ? getMobileUniformCinematicScale() : getHomeLogoDisplayScale());
applyFix('defaultHomeSettleScale',
    /const defaultHomeSettleScale = revealHomeUi\s*\? getRevealHomeVideoScale\(reverseSrc\)\s*: \(isMobile \? getMobileUniformCinematicScale\(\) : getHomeLogoDisplayScale\(\)\);/s,
    'const defaultHomeSettleScale = revealHomeUi\\n        ? getRevealHomeVideoScale(reverseSrc)\\n        : (isMobile ? getMobileUniformCinematicScale() : DESKTOP_SECTION_HOME_RETURN_SCALE);'
);

fs.writeFileSync('main-v2.js', code, 'utf8');
console.log('\\nAll done. File saved.');
