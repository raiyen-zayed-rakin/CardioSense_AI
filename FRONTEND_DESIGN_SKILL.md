---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building or reshaping CardioSense UI. Use when creating pages, components, or visual systems — aesthetic direction, typography, layout, motion, and copy that avoid generic AI-template defaults while staying true to clinical + home-monitoring context.
license: Adapted for project use from Anthropic frontend-design skill patterns; not an official Anthropic file.
---

# Frontend Design (CardioSense)

Approach this as the design lead for **CardioSense AI**: continuous ECG monitoring with a clinician console and a home/guest live path. The product must feel like a serious instrument — not a SaaS marketing template, not a purple AI dashboard, and not a newspaper pastiche. Make deliberate, opinionated choices about palette, typography, and layout that fit **ECG / clinical decision-support / home kit** vernacular. Take aesthetic risk only when it strengthens that identity.

Companion skill: `UI_UX_SKILL.md` (interaction, a11y, density, charts). This file owns **visual identity and craft**. When they conflict, prefer usability and clinical clarity over decoration.

## Ground designs in the subject matter

Before coding UI, lock three answers (propose them if the brief is vague):

| Axis | CardioSense default |
|------|---------------------|
| **Subject** | Live single-lead ECG, beat labels (N/S/V/F), rhythm rules, risk, alerts, Dr. Aime guide |
| **Audience** | Clinicians (signed-in console) and home users (guest `/home`) |
| **Primary job** | See the rhythm now and understand what changed — without diagnosing |

Industry vernacular to draw from: bedside monitors, strip chart paper, calibrated grids, muted instrument chrome, high-contrast waveform, sparse status chrome. Materials: light frosted glass, cool clinical paper, ink teal trace, coral for danger — not neon cyberpunk, not wellness spa cream.

Build with **real product content** (replay status, MRN, risk bands, alert tiers). Do not invent fake marketing stats in the first viewport of functional screens.

## Design principles

### Hero / first viewport

For **marketing or login** surfaces: open with the most characteristic thing — live ECG energy, instrument grid, clear product name. Prefer atmosphere + one CTA over a “big number + gradient accent + three stat chips” default.

For **app screens** (`/home`, `/monitor`, `/patients`): the first viewport is an **instrument**, not a hero. Primary signal (waveform or triage list) must dominate. Do not bury insights behind endless stacked cards.

### Typography

Typography carries personality. Prefer **one family or two** (display + body only if clearly distinct).

- Choose faces deliberately — avoid Inter / Roboto / Arial / system as the “design.”
- Set a clear type scale (weights, sizes, line-height). Body ~16px; line-height ~1.5.
- Line length ideally &lt; ~80 characters for prose.
- Type in headlines can be expressive; type in clinical panels stays legible and calm.

**Avoid these generated-page typography tells:**

- Accenting a single word in a headline (one italic / one colored word)
- Tracked-out ALL-CAPS eyebrows above every heading
- Unnecessary labels above content that already has a clear title

### Structure encodes meaning

Borders, dividers, tabs, and labels should **inform hierarchy**, not decorate.

- Numbered markers (01 / 02 / 03) only if content is truly sequential
- Prefer tabs / rails for secondary insights over identical card stacks
- One border-radius language with intentional exceptions (e.g. chat bubbles vs instrument panels)

### Motion

- Non-user-triggered motion: sparingly (one orchestrated moment &gt; fade-up on every section)
- User-triggered motion (open panel, tab change, stream start): welcome when it shows what changed
- Always respect `prefers-reduced-motion`
- Live pulse indicators only for true live state — not decorative breathing on every chrome piece

### Copy is design

Words exist to make the product understandable. Same intentionality as spacing and color.

- Name things for users (“Open console”, “Start replay”), not internals (`GET /v1/...`)
- Active voice; sentence case; CTA says what happens (“Save changes”, not “Submit”)
- Keep vocabulary consistent across the flow
- Errors: what went wrong + how to fix; no vague apologies
- Empty states: invitation to act
- Safety language where needed: research demo, not a medical device, decision support only — once, clearly, not as filler on every line

## Anti-patterns (AI design cluster)

These looks are legitimate for *some* briefs, but they are **defaults**, not choices. Do **not** spend free axes of the CardioSense brief on them unless the user explicitly asks:

1. Warm cream background (~`#F4F1EA`) + high-contrast serif display + terracotta/clay accent
2. Near-black + single acid-green or vermilion accent as the whole personality
3. Broadsheet / newspaper: hairline rules, zero radius, dense columns
4. **SaaS-card kit**: everything in identical rounded cards, one radius everywhere, soft grey shadow under each, gradient washes as decoration
5. Template chrome regardless of subject: ALL-CAPS eyebrows; meta joined with middle dots (`A · B · C`); `WORD — fragment` em-dash labels; tinted near-black as black; monospace for every data label; trailing `→` on every link/button
6. Purple-on-white or purple-to-indigo “AI product” gradients
7. Emoji as UI icons

Where the brief pins a direction, follow it. Where it leaves freedom, spend that freedom on **instrument / clinical / home-kit** character — not the list above.

## Process: plan → review → build → critique

Work in **two passes**.

### Pass 1 — Short design plan (tokens + layout)

Create a compact token system before coding:

- **Color:** 4–6 named values (base, surface, primary, danger, warning, accent). Prefer CSS variables; avoid scattering raw hex in components.
- **Type:** face(s) + roles (display / body / data).
- **Layout:** one-sentence concept + ASCII wireframe. Alignment (left / center). For live ECG: **waveform primary + insight rail/tabs**, not a vertical card dump.
- **Principles:** 2–4 bullets unique to this screen (e.g. “strip never leaves the first viewport on desktop”).

### Pass 2 — Review against the brief

Ask: would this plan look the same for *any* SaaS dashboard? If yes, revise. Say what changed and why. Only then write code.

When coding CSS/Tailwind, watch specificity fights (utility cancelation, competing padding on wrappers). Prefer composition over one-off magic numbers.

### Pass 3 — Self-critique (Chanel rule)

Spend boldness in **one** place; keep surroundings quiet. Before finishing, remove one accessory.

Quality floor (always):

- Responsive to mobile
- Visible keyboard focus
- Reduced motion respected
- Contrast usable in light clinical theme
- Meaning not by color alone (labels, patterns, text for N/S/V/F and risk tiers)
- Touch targets ≥ 44×44 where interactive

If screenshots are available, review the real pixels — not only the code.

## CardioSense locked direction (current product)

Use this as the active brief unless the user overrides it:

| Token / choice | Direction |
|----------------|-----------|
| Theme | Clinical daylight (cool paper white, not cream spa) |
| Primary | Ink teal (`--primary`) — readable on light |
| Danger | Coral / red (`--destructive`) |
| Warning / watch | Amber (`--warning`) |
| Fusion / accent data | Violet (`--fusion`) sparingly |
| Surfaces | Frosted light glass + soft instrument grid; ECG uses classic strip-paper grid |
| Live console | ECG strip dominant; Rhythm / Risk / Alerts / Beats as tabs or rail |
| Auth | Login may be atmospheric; app chrome stays instrument-quiet |
| Guest home | Same instrument language as clinician monitor; banner for “no account / sensor later” |
| Assistant | Dr. Aime is a guide overlay — cream accent OK for chathead only; don’t paint the whole app cream |

## Stack notes (this repo)

- Next.js App Router + Tailwind + shadcn-style primitives in `MAIN_MVP/web`
- Prefer existing components (`Button`, `Badge`, `Alert`) over new visual systems mid-task
- Shared live UI: `LiveEcgWorkspace`; shell: `AppShell`; assistant: `DrAimeChathead`
- Tokens live in `app/globals.css` — extend variables there before hardcoding colors in JSX

## When to apply vs skip

**Apply** when building/changing pages, components, visual systems, motion, or UI copy.

**Skip** for pure API/DB/ML work unless the change alters what the user sees or interacts with.

## Relationship to UI_UX_SKILL.md

| Concern | Prefer |
|---------|--------|
| A11y, touch, forms, nav patterns, chart encoding | `UI_UX_SKILL.md` |
| Aesthetic direction, anti-slop, typography personality, composition boldness | this file |
| Conflict (pretty vs usable) | usability + clinical clarity wins |

## Quick pre-ship checklist

- [ ] Plan had a non-generic token/layout choice reviewed against the brief
- [ ] Not the SaaS-card kit or purple AI default
- [ ] Live screens keep the primary signal visible without hunting
- [ ] Copy has no API-route leftovers in user-facing UI
- [ ] Motion is intentional; reduced-motion OK
- [ ] Risk/beat meaning uses more than color alone
- [ ] Mobile: usable nav + targets; no hover-only critical actions
