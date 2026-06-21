# WORKING

- Current desktop choreography should remain.
- Current synchronization architecture should remain.
- Video stitching/routing mostly works.
- Mobile should not be touched.

# BROKEN

Transitions feel too visibly:
zoom-out → equilibrium → zoom-in.

The equilibrium/logo routing feels too explicit.

Examples:
- Intro → Home visibly shrinks/snaps into equilibrium.
- About → Services visibly resets into equilibrium before next intro.
- Same visible reset feeling exists between most sections.

The viewer should not consciously perceive:
- equilibrium resets
- visible normalization
- repeated zoom-out → zoom-in cycles

# EXPECTED RESULT

Transitions should feel more continuous:

section extro momentum
→ seamless equilibrium bridge
→ next intro continuation

without obvious reset behavior.

# IMPORTANT

Do NOT:
- rebuild synchronization
- rewrite video stitching
- redesign choreography
- touch mobile
- add heavy blur
- rebuild architecture

Preserve current synchronization stability.