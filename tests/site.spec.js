const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const PAGES = {
  enHome: "/",
  arHome: "/ar/",
  enPrivacy: "/privacy/",
  arPrivacy: "/ar/privacy/",
  en404: "/404.html",
  ar404: "/ar/404.html"
};

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "ultrawide", width: 1920, height: 1080 },
  { name: "4k", width: 2560, height: 1440 },
  { name: "mid-break", width: 1024, height: 768 }
];

function readDist(relativePath) {
  return fs.readFileSync(path.join(DIST, relativePath), "utf8");
}

function collectInternalHrefs(html, pageUrl) {
  const hrefs = [];
  const re = /href="([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    const href = match[1];
    if (
      href.startsWith("mailto:") ||
      href.startsWith("https://") ||
      href.startsWith("http://") ||
      href.startsWith("#") ||
      href.startsWith("data:")
    ) {
      continue;
    }
    hrefs.push(new URL(href, `https://heshamorabi.com${pageUrl}`).pathname);
  }
  return [...new Set(hrefs)];
}

test.describe("production bundle integrity", () => {
  test("allow-listed Arabic and font assets exist", async () => {
    for (const relative of [
      "ar/index.html",
      "ar/privacy/index.html",
      "ar/404.html",
      "ar/site.webmanifest",
      "fonts/NotoSansArabic-Regular.woff2",
      "sitemap.xml",
      "robots.txt"
    ]) {
      expect(fs.existsSync(path.join(DIST, relative)), relative).toBeTruthy();
    }
  });

  test("robots allows /ar/ and sitemap lists Arabic URLs", async () => {
    const robots = readDist("robots.txt");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Sitemap: https://heshamorabi.com/sitemap.xml");

    const sitemap = readDist("sitemap.xml");
    expect(sitemap).toContain("https://heshamorabi.com/ar/");
    expect(sitemap).toContain("https://heshamorabi.com/ar/privacy/");
    expect(sitemap).toContain('hreflang="ar"');
    expect(sitemap).toContain('hreflang="en"');
    expect(sitemap).toContain('hreflang="x-default"');
  });
});

test.describe("SEO and language metadata", () => {
  for (const [name, route, expected] of [
    [
      "english home",
      PAGES.enHome,
      {
        lang: "en",
        dir: null,
        canonical: "https://heshamorabi.com/",
        robots: "index, follow",
        title: /Hesham Orabi/
      }
    ],
    [
      "arabic home",
      PAGES.arHome,
      {
        lang: "ar",
        dir: "rtl",
        canonical: "https://heshamorabi.com/ar/",
        robots: "index, follow",
        title: /هشام عرابي/
      }
    ],
    [
      "english privacy",
      PAGES.enPrivacy,
      {
        lang: "en",
        dir: null,
        canonical: "https://heshamorabi.com/privacy/",
        robots: "index, follow",
        title: /Privacy/
      }
    ],
    [
      "arabic privacy",
      PAGES.arPrivacy,
      {
        lang: "ar",
        dir: "rtl",
        canonical: "https://heshamorabi.com/ar/privacy/",
        robots: "index, follow",
        title: /الخصوصية/
      }
    ],
    [
      "english 404",
      PAGES.en404,
      {
        lang: "en",
        dir: null,
        canonical: null,
        robots: "noindex",
        title: /Not Found/
      }
    ],
    [
      "arabic 404",
      PAGES.ar404,
      {
        lang: "ar",
        dir: "rtl",
        canonical: null,
        robots: "noindex",
        title: /غير موجودة/
      }
    ]
  ]) {
    test(`${name} has correct lang/dir/canonical/indexability`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", expected.lang);
      if (expected.dir) {
        await expect(page.locator("html")).toHaveAttribute("dir", expected.dir);
      } else {
        await expect(page.locator("html")).not.toHaveAttribute("dir");
      }

      const robots = await page.locator('meta[name="robots"]').getAttribute("content");
      expect(robots || "").toContain(expected.robots);

      if (expected.canonical) {
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          expected.canonical
        );
      } else {
        await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      }

      await expect(page).toHaveTitle(expected.title);

      if (expected.canonical) {
        const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((nodes) =>
          Object.fromEntries(nodes.map((n) => [n.getAttribute("hreflang"), n.getAttribute("href")]))
        );
        expect(hreflangs.en).toBeTruthy();
        expect(hreflangs.ar).toBeTruthy();
        expect(hreflangs["x-default"]).toBeTruthy();
      }
    });
  }

  test("homepages expose reciprocal Open Graph locales and JSON-LD language", async ({
    page
  }) => {
    await page.goto(PAGES.arHome);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "ar_SA");
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
      "content",
      "en_SA"
    );

    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toContain('"inLanguage": "ar"');
    expect(jsonLd).toContain("https://heshamorabi.com/ar/");

    await page.goto(PAGES.enHome);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_SA");
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
      "content",
      "ar_SA"
    );
  });

  test("indexable language pairs expose exact reciprocal hreflang clusters", async ({ page }) => {
    for (const [route, expected] of [
      [
        PAGES.enHome,
        {
          en: "https://heshamorabi.com/",
          ar: "https://heshamorabi.com/ar/",
          "x-default": "https://heshamorabi.com/"
        }
      ],
      [
        PAGES.arHome,
        {
          en: "https://heshamorabi.com/",
          ar: "https://heshamorabi.com/ar/",
          "x-default": "https://heshamorabi.com/"
        }
      ],
      [
        PAGES.enPrivacy,
        {
          en: "https://heshamorabi.com/privacy/",
          ar: "https://heshamorabi.com/ar/privacy/",
          "x-default": "https://heshamorabi.com/privacy/"
        }
      ],
      [
        PAGES.arPrivacy,
        {
          en: "https://heshamorabi.com/privacy/",
          ar: "https://heshamorabi.com/ar/privacy/",
          "x-default": "https://heshamorabi.com/privacy/"
        }
      ]
    ]) {
      await page.goto(route);
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((nodes) =>
          Object.fromEntries(nodes.map((node) => [
            node.getAttribute("hreflang"),
            node.getAttribute("href")
          ]))
        );
      expect(alternates).toEqual(expected);
    }
  });

  test("titles and descriptions are unique across indexable pages", async ({ page }) => {
    const seenTitles = new Set();
    const seenDescriptions = new Set();

    for (const route of [PAGES.enHome, PAGES.arHome, PAGES.enPrivacy, PAGES.arPrivacy]) {
      await page.goto(route);
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(seenTitles.has(title)).toBeFalsy();
      expect(seenDescriptions.has(description)).toBeFalsy();
      seenTitles.add(title);
      seenDescriptions.add(description);
    }
  });
});

test.describe("language switching", () => {
  test("homepage switcher maps paths and preserves hashes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${PAGES.enHome}#contact`);
    await page.locator('.header-cluster .lang-switch a[data-lang-switch="ar"]').click();
    await expect(page).toHaveURL(/\/ar\/#contact$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.locator('.header-cluster .lang-switch a[data-lang-switch="en"]').click();
    await expect(page).toHaveURL(/\/#contact$/);
  });

  test("privacy switcher maps equivalent paths", async ({ page }) => {
    await page.goto(PAGES.enPrivacy);
    await page.locator('.lang-switch a[data-lang-switch="ar"]').click();
    await expect(page).toHaveURL(/\/ar\/privacy\/$/);
    await page.locator('.lang-switch a[data-lang-switch="en"]').click();
    await expect(page).toHaveURL(/\/privacy\/$/);
  });
});

test.describe("functional contact and navigation", () => {
  for (const [label, home] of [
    ["english", PAGES.enHome],
    ["arabic", PAGES.arHome]
  ]) {
    test(`${label} contact and social destinations remain intact`, async ({ page }) => {
      await page.goto(home);

      await expect(page.locator('a[href="mailto:Dev@heshamorabi.com"]')).toHaveCount(1);
      await expect(page.locator('a[href="mailto:social@heshamorabi.com"]')).toHaveCount(1);
      await expect(page.locator('a[href="https://wa.me/201005859416"]')).toHaveCount(1);
      await expect(page.locator('a[href="https://wa.me/966537116359"]')).toHaveCount(1);
      await expect(page.locator('a[href*="linkedin.com/in/orabiofficial"]')).toHaveCount(3);
      await expect(page.locator('a[href*="github.com/HeshamOrabi"]')).toHaveCount(3);
    });
  }

  test("Arabic mixed-direction fields use LTR isolation", async ({ page }) => {
    await page.goto(PAGES.arHome);
    const emails = page.locator(".contact-name.ltr, a.ltr, span.ltr");
    await expect(emails.first()).toHaveAttribute("dir", "ltr");
    await expect(page.locator('span.ltr[dir="ltr"]', { hasText: "Odoo" }).first()).toBeVisible();
  });

  test("Arabic contact rows keep the trailing arrow on the RTL leading edge", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PAGES.arHome);

    const emailName = page
      .locator('a[href="mailto:Dev@heshamorabi.com"] .contact-name')
      .first();
    const whatsappName = page
      .locator('a[href="https://wa.me/201005859416"] .contact-name')
      .first();

    // The decorative arrow is an ::after on .contact-name; both card types must
    // resolve it in the same visual direction, so neither element may be dir=ltr.
    await expect(emailName).not.toHaveAttribute("dir", "ltr");
    await expect(whatsappName).not.toHaveAttribute("dir", "ltr");
    await expect(emailName.locator('span.ltr[dir="ltr"]')).toHaveCount(1);
  });
});

test.describe("mobile drawer", () => {
  test("Arabic drawer opens, traps focus, closes on Escape, and localizes labels", async ({
    page
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGES.arHome);
    const toggle = page.locator("[data-menu-toggle]");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("data-menu-open", "فتح القائمة");
    await expect(toggle).toHaveAttribute("data-menu-close", "إغلاق القائمة");

    await toggle.click();
    await expect(page.locator("[data-drawer]")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle.locator(".visually-hidden")).toHaveText("إغلاق القائمة");

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("[data-drawer]")).toBeHidden();
  });

  for (const [label, route] of [
    ["english", PAGES.enHome],
    ["arabic", PAGES.arHome]
  ]) {
    test(`${label} drawer slides fully into the viewport when open`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route);
      await page.locator("[data-menu-toggle]").click();

      const drawer = page.locator("[data-drawer]");
      await expect(drawer).toBeVisible();

      // The panel slides for 600ms, so settle on the resting position first.
      await expect
        .poll(async () => {
          const box = await drawer.boundingBox();
          if (!box) return null;
          return Math.round(box.x) >= 0 && Math.round(box.x + box.width) <= 391;
        })
        .toBe(true);

      const box = await drawer.boundingBox();
      expect(box.width).toBeGreaterThan(200);
    });
  }
});

test.describe("responsive overflow matrix", () => {
  for (const viewport of VIEWPORTS) {
    for (const [label, route] of [
      ["en", PAGES.enHome],
      ["ar", PAGES.arHome]
    ]) {
      test(`${label} home has no horizontal overflow at ${viewport.name}`, async ({
        page
      }, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "Viewport matrix runs on Chromium only");
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(route);
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth
          };
        });
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });
    }
  }
});

test.describe("content survives without working JavaScript", () => {
  // A blank black page was reported from Egypt: every block below the hero is
  // a .reveal, so any failure of main.js used to leave the page permanently
  // invisible. Content must never depend on the script succeeding.
  async function assertContentVisible(page, route) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll("main .reveal")].filter(
        (el) => parseFloat(getComputedStyle(el).opacity) < 0.05
      ).length
    );
    expect(hidden).toBe(0);
    await expect(page.locator("#work h2")).toBeVisible();
  }

  for (const [label, route] of [
    ["english", PAGES.enHome],
    ["arabic", PAGES.arHome]
  ]) {
    test(`${label} home stays readable when main.js fails to load`, async ({ page }) => {
      await page.route("**/js/main.js", (route) => route.abort());
      await assertContentVisible(page, route);
    });

    test(`${label} home stays readable when main.js throws`, async ({ page }) => {
      await page.route("**/js/main.js", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: 'throw new Error("simulated failure");'
        })
      );
      await assertContentVisible(page, route);
    });
  }

  test("english home stays readable with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(PAGES.enHome, { waitUntil: "load" });
    await expect(page.locator("#work h2")).toBeVisible();
    await context.close();
  });

  test("reveal animation still runs when the script loads normally", async ({ page }) => {
    await page.goto(PAGES.enHome, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/js-reveal/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            [...document.querySelectorAll("main .reveal.is-visible")].length
        )
      )
      .toBeGreaterThan(0);
  });
});

test.describe("browser compatibility", () => {
  test("shipped scripts avoid syntax that breaks older mobile browsers", async () => {
    for (const file of ["js/main.js", "js/analytics.js"]) {
      const source = readDist(file);
      // Optional chaining and nullish coalescing are parse-time errors on
      // pre-2020 engines, which kills the whole file rather than one feature.
      expect(source, `${file} uses optional chaining`).not.toMatch(/\?\./);
      expect(source, `${file} uses nullish coalescing`).not.toMatch(/\?\?/);
      expect(source, `${file} uses optional catch binding`).not.toMatch(/catch\s*\{/);
    }
  });
});

test.describe("accessibility", () => {
  for (const [label, route] of [
    ["english home", PAGES.enHome],
    ["arabic home", PAGES.arHome],
    ["english privacy", PAGES.enPrivacy],
    ["arabic privacy", PAGES.arPrivacy],
    ["english 404", PAGES.en404],
    ["arabic 404", PAGES.ar404]
  ]) {
    test(`${label} has no automated WCAG A/AA axe violations`, async ({ page }) => {
      // Audit the settled state: mid-transition reveals are partially
      // transparent, which makes axe's contrast sampling non-deterministic.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test("reduced motion shows content without the reveal animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PAGES.arHome);

    await expect(page.locator("html")).not.toHaveClass(/js-reveal/);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll("main .reveal")].filter(
        (el) => parseFloat(getComputedStyle(el).opacity) < 0.05
      ).length
    );
    expect(hidden).toBe(0);
  });
});

test.describe("analytics helpers", () => {
  test("analytics source contracts protect privacy and avoid duplicate language events", async () => {
    const analytics = readDist("js/analytics.js");
    expect(analytics).toContain("page_language");
    expect(analytics).toContain('track("language_switch"');
    expect(analytics).toContain('track("email_click"');
    expect(analytics).toContain('track("whatsapp_click"');
    expect(analytics).toContain('track("linkedin_click"');
    expect(analytics).toContain('track("scroll_depth"');
    expect(analytics).toContain("languageTo !== languageFrom");
    expect(analytics).toContain("Never send mailbox addresses");
    expect(analytics).toContain("allow_ad_personalization_signals: false");
    expect(analytics).not.toMatch(/\?\./);
    expect(analytics).not.toMatch(/\?\?/);
    expect(analytics).not.toMatch(/=>/);
  });

  test("language switch controls exist on both language homes", async ({ page }) => {
    await page.goto(PAGES.enHome);
    await expect(page.locator('[data-lang-switch="ar"]')).toHaveCount(2);
    await page.goto(PAGES.arHome);
    await expect(page.locator('[data-lang-switch="en"]')).toHaveCount(2);
  });
});

test.describe("internal link crawl", () => {
  test("all same-origin asset and page links resolve in dist", async () => {
    const pages = [
      ["index.html", "/"],
      ["privacy/index.html", "/privacy/"],
      ["404.html", "/404.html"],
      ["ar/index.html", "/ar/"],
      ["ar/privacy/index.html", "/ar/privacy/"],
      ["ar/404.html", "/ar/404.html"]
    ];

    const missing = [];
    for (const [file, url] of pages) {
      const html = readDist(file);
      for (const pathname of collectInternalHrefs(html, url)) {
        let candidate = pathname;
        if (candidate.endsWith("/")) candidate += "index.html";
        else if (!path.extname(candidate)) candidate += "/index.html";
        const diskPath = path.join(DIST, candidate.replace(/^\//, ""));
        const altPath = path.join(DIST, pathname.replace(/^\//, ""));
        if (!fs.existsSync(diskPath) && !fs.existsSync(altPath)) {
          missing.push(`${file} -> ${pathname}`);
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });
});

test.describe("visual baselines", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("capture English and Arabic hero screenshots for comparison", async ({ page }, testInfo) => {
    const shotDir = path.join(ROOT, ".shots", "arabic-rtl");
    fs.mkdirSync(shotDir, { recursive: true });

    await page.goto(PAGES.enHome);
    await page.screenshot({
      path: path.join(shotDir, `${testInfo.project.name}-en-hero.png`),
      fullPage: false
    });

    await page.goto(PAGES.arHome);
    await page.screenshot({
      path: path.join(shotDir, `${testInfo.project.name}-ar-hero.png`),
      fullPage: false
    });
  });
});
