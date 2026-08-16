# Hesham Orabi — Portfolio

Personal site for [heshamorabi.com](https://heshamorabi.com), hosted on Netlify.

Positioning: **Odoo technofunctional consultant · ERP project manager · IT infrastructure · IT BOQ & tender.**

## Design

Black / cream editorial. A single full-viewport hero composition — blurred backdrop, giant
scrolling name, portrait layered over the letters, and visible professional positioning —
followed by centred editorial content sections and outlined contact groups. No accent color.

Rules live in `design-system/hesham-orabi-portfolio/MASTER.md`
(generated with UI UX Pro Max, motion cues from MotionSites).

## Stack

Static HTML / CSS / JS — no build step, no dependencies. Netlify publishes the repo root.

## Local preview

```bash
python3 -m http.server 5173
```

Then visit `http://localhost:5173`.

## Structure

```
index.html      hero + content sections
css/tokens.css  colors, font stack, easings, marquee duration
css/main.css    layout, layers, animations
js/main.js      accessible drawer, reload handling, scroll reveal
js/analytics.js GA4 loader and meaningful engagement events
images/         portrait cutout (2 sizes), avatar, og card
robots.txt      crawler access and sitemap discovery
sitemap.xml     canonical public URL
404.html        branded not-found page
```

## Images

Derived from a background-removed portrait PNG with Pillow. The alpha channel is cleaned on
import: values `<= 12` are forced to 0 (removes faint background speckle) and values `>= 200`
to 255 (the source was never fully opaque, which made the figure look translucent on dark).
The genuine antialiased band in between is preserved so edges stay soft.

The source must keep the whole figure inside the canvas — if arms or shoulders touch the canvas
edge, they render as straight vertical slices against the dark background.

- `hesham-orabi-portrait.webp` — full-size cutout, 914×1448, used from 640px up
- `hesham-orabi-portrait-mobile.webp` — 62% scale for small screens
- `avatar.webp` — square head crop on ink, favicon
- `favicon.ico` / `favicon-48x48.png` / `favicon-32x32.png` — browser and search favicons
- `apple-touch-icon.png` — iOS home-screen icon
- `icon-192.png` / `icon-512.png` — web app manifest icons
- `hesham-orabi-social-preview.jpg` — 1200×630 Open Graph card
- `logo-128.webp` / `logo-256.webp` — header badge, recolored from `logo.png`

`logo.png` is the original mark from the previous site: white lettering on a black disc. Because
a black disc disappears against the `--ink` background, the header versions are recolored to a
cream disc with ink lettering, inverting luminance while preserving the antialiased edges.

The hero background is pure CSS (`--ink` plus two radial lifts and grain) — no background photo.

## Typography

The site uses the local system Helvetica/Arial stack. There is no render-blocking font request,
font-license attribution dependency, or webfont-driven layout shift.

## Analytics

Analytics uses GA4 Measurement ID `G-22RTPBC0SD` in `js/analytics.js`. Netlify can still override
it with `GA4_MEASUREMENT_ID` at build time. Analytics loads automatically and tracks page views,
scroll depth, section views, navigation, email, WhatsApp, LinkedIn, and other professional-profile
interactions. It runs only on the production host. No message contents or sensitive personal data
are sent. GA first-party cookies use `Secure`, `SameSite=Lax`, a 90-day maximum lifetime, and no
rolling expiry; details are published at `/privacy/`.

After data begins arriving in GA4, mark `email_click`, `whatsapp_click`, and `linkedin_click` as
key events in the GA4 Admin interface. Phone, contact-form, CV, and project events are deliberately
not emitted because those interactions do not exist on the current site.

## Search indexing

- Submit `https://heshamorabi.com/sitemap.xml` in Google Search Console.
- The HTML verification file `google89f5d47728259c41.html` is included in the production
  bundle. After deploy, open `https://heshamorabi.com/google89f5d47728259c41.html`, then click
  Verify in Search Console.
- The homepage is canonical at `https://heshamorabi.com/`; `/index.html` and the `www` host
  redirect to it.
- `404.html` is explicitly `noindex, follow`; the public homepage remains indexable.

## Security and operations

- Netlify applies HSTS, a restrictive CSP, clickjacking protection, MIME-sniffing protection,
  referrer and permissions policies, and cross-origin isolation headers.
- The CSP has no wildcard, `unsafe-inline`, or `unsafe-eval`; GA4 is the only external script.
- `scripts/build.py` publishes an explicit 24-file allowlist. Preview and branch builds receive a
  generated `X-Robots-Tag: noindex, nofollow, noarchive` header and never send production analytics.
- The site has no form, API, database, authentication, or upload surface. Server-side validation,
  CSRF, CORS, rate limiting, database backups, and password controls are therefore not applicable.
- `/.well-known/security.txt` publishes the responsible security contact.
- Netlify deploy history provides rollback. Configure Netlify deploy-failure notifications and an
  external HTTPS uptime monitor after launch.
- Email DNS uses Zoho MX and SPF. DMARC was not present during the 16 August 2026 audit; confirm
  Zoho DKIM and add DMARC through the DNS provider before treating email authentication as complete.

## Still to personalise

- Real project examples (content is capability-based; no invented stats)
- Certifications (Odoo, PMP/PRINCE2) if applicable
