# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Hesham Orabi Portfolio  
**Positioning:** Odoo Technofunctional Consultant · ERP Project Manager · IT Infrastructure · IT BOQ & Tender  
**Direction:** Black / cream editorial — full-viewport hero composition  
**Updated:** 2026-08-16

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Cream (all text/UI) | `#EFEEE9` | `--cream` |
| Ink (page background) | `#0B0B0B` | `--ink` |
| Drawer panel | `#141414` | `--panel` |

Cream on dark photography only. **No accent color, no gradients, no purple/pink, no cards.**
Hairlines are `rgba(239,238,233,0.16)`; secondary text is cream at 50–78% opacity.

### Typography

- **Single family:** `"Helvetica Neue", Helvetica, Arial, sans-serif`
- System font stack only: no render-blocking font request or font-license dependency
- No Inter, no Roboto, no display/serif pairing
- Headings `font-weight: 400`, `letter-spacing: -0.02em`
- Labels: `0.75rem`, `letter-spacing: 0.22em`, uppercase, cream at 50%

### Hero Composition

Single `100dvh` section, `overflow: hidden`. One composition — no cards, no CTA buttons.

| Layer | z | Content |
|-------|---|---------|
| Stage | default | CSS-only ink + radial lifts, `anim-fade-in` |
| Marquee name | 10 | `Hesham — Orabi` ×2, seamless loop |
| Cream rule | 10 | `anim-line`, grows from left |
| Desktop footer | 10 | role lines + availability |
| Portrait | 20 | transparent cutout, letters read behind the silhouette |
| Header / mobile footer | 30 | brand, year, nav, social |
| Drawer backdrop | 40 | blurred overlay |
| Drawer panel | 45 | right slide-in |
| Hamburger / close | 50 | always on top |

Marquee: `16vh` top / `16vh` text on mobile, `14vh` top / `26vh` text from `640px`.

### Motion

| Class | Effect | Duration / easing | Delay |
|-------|--------|-------------------|-------|
| `anim-fade-in` | opacity 0→1 | 1.2s ease-out | 0 |
| `anim-rise-in` | opacity + `translateY(4vh) scale(1.03)`→0 | 1.4s `cubic-bezier(0.22,1,0.36,1)` | 300ms |
| `anim-fade-up` | opacity + `translateY(28px)`→0 | 0.9s `cubic-bezier(0.22,1,0.36,1)` | see below |
| `anim-line` | `scaleX(0)`→1, origin left | 1.1s `cubic-bezier(0.76,0,0.24,1)` | 1200ms |
| `.marquee` | `translateX(0)`→`-50%` | 30s linear infinite | 0 |

`anim-fade-up` delays: marquee 500 · brand 800 · year + hamburger 900 · nav 1000+i·80 ·
social 1150+i·80 · footer left 1400 · footer right 1550 · scroll cue 1700.

Drawer: panel 600ms `cubic-bezier(0.76,0,0.24,1)`, backdrop 500ms, close icon delay 300ms,
nav links 300+i·80, socials 550+i·60, hamburger bars 500ms with middle fading at 300ms.

Content below hero: scroll reveal `translateY(20px)`, 700ms, staggered 80ms.

`prefers-reduced-motion: reduce` collapses entrance animations to 0.01ms / 0 delay,
stops the marquee and scroll cue, and renders final states.

### Anti-Patterns

- No decorative cards, pills, glows, or shadows; outlined contact groups are the single functional exception
- No purple/pink or AI gradients
- No Inter / Roboto
- No second accent color
- No scroll-jacking or parallax
- No emoji icons

### Pre-Delivery Checklist

- [ ] Cream on dark meets 4.5:1 for body copy
- [ ] Focus-visible outlines present
- [ ] Reduced motion respected
- [ ] Responsive: 375 / 768 / 1024 / 1440
- [ ] Hero holds one viewport with no internal scroll
- [ ] No third-party font dependency
