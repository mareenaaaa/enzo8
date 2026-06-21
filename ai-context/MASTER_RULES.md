# MASTER RULES

Preserve the cinematic video-first architecture.

Prefer refinement over regeneration.

Never rewrite layout structure unless explicitly requested.

Never modify unrelated components.

Change animation values parametrically before changing architecture.

Keep edits scoped to one surface per iteration.

Protect:
- video transition timing
- preload behavior
- pointer-events
- z-index layering
- body state classes
- section sequencing

When refining animations:
- prefer modifying values over replacing logic
- preserve state sequencing
- avoid introducing new animation systems
- reuse existing timing architecture whenever possible

Only refine:
- animations
- easing
- transforms
- perspective
- hover interpolation
- transitions
- opacity
- shadows
- motion blur
- timing
- interaction smoothness

Preserve:
- responsiveness
- Tailwind/classes
- component hierarchy
- fullscreen section behavior
- portfolio playback behavior

Never add decorative glow/blur unless it improves:
- readability
- transition continuity
- cinematic depth

Mobile UI must feel like native premium UI,
not scaled-down desktop screenshots.

Goal:
Premium cinematic motion.
Subtle depth.
Smooth interpolation.
Restrained interaction design.