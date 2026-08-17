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
  { name: "w320", width: 320, height: 700 },
  { name: "w359", width: 359, height: 800 },
  { name: "w360", width: 360, height: 800 },
  { name: "w375", width: 375, height: 812 },
  { name: "phone-portrait", width: 390, height: 844 },
  { name: "w414", width: 414, height: 896 },
  { name: "w430", width: 430, height: 932 },
  { name: "w479", width: 479, height: 900 },
  { name: "w480", width: 480, height: 900 },
  { name: "w481", width: 481, height: 900 },
  { name: "w600", width: 600, height: 960 },
  { name: "w639", width: 639, height: 900 },
  { name: "w640", width: 640, height: 900 },
  { name: "w641", width: 641, height: 900 },
  { name: "w767", width: 767, height: 1024 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "w769", width: 769, height: 1024 },
  { name: "w800", width: 800, height: 1000 },
  { name: "w820", width: 820, height: 1180 },
  { name: "tablet-large-portrait", width: 834, height: 1194 },
  { name: "phone-landscape", width: 844, height: 390 },
  { name: "w959", width: 959, height: 800 },
  { name: "w960", width: 960, height: 800 },
  { name: "w961", width: 961, height: 800 },
  { name: "w1023", width: 1023, height: 768 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "w1025", width: 1025, height: 768 },
  { name: "tablet-large-landscape", width: 1194, height: 834 },
  { name: "w1280", width: 1280, height: 800 },
  { name: "w1366", width: 1366, height: 768 },
  { name: "w1439", width: 1439, height: 900 },
  { name: "w1440", width: 1440, height: 900 },
  { name: "w1441", width: 1441, height: 900 },
  { name: "w1536", width: 1536, height: 864 },
  { name: "w1600", width: 1600, height: 900 },
  { name: "w1728", width: 1728, height: 1117 },
  { name: "w1920", width: 1920, height: 1080 },
  { name: "w2560", width: 2560, height: 1440 },
  { name: "w3440", width: 3440, height: 1440 },
  { name: "w3840", width: 3840, height: 2160 }
];

function readDist(relativePath) {
  return fs.readFileSync(path.join(DIST, relativePath), "utf8");
}

async function enableLocalAnalytics(page) {
  const source = readDist("js/analytics.js");
  const patched = source.replace(
    '"www.heshamorabi.com": true',
    '"www.heshamorabi.com": true,\n    "127.0.0.1": true'
  );
  if (patched === source) throw new Error("Could not enable analytics for local runtime testing");

  await page.route("**/js/analytics.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: patched })
  );
  await page.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
  );
}

async function clickWithoutNavigation(locator) {
  await locator.evaluate((element) => {
    element.addEventListener("click", (event) => event.preventDefault(), { once: true });
    element.click();
  });
}

async function getAnalyticsEvents(page) {
  return page.evaluate(() =>
    (window.dataLayer || [])
      .map((entry) => Array.from(entry))
      .filter((entry) => entry[0] === "event")
      .map((entry) => ({ name: entry[1], parameters: entry[2] }))
  );
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
      "robots.txt",
      "images/hesham-orabi-social-preview-ar.jpg"
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

  test("indexable pages expose complete search and social metadata", async ({ page }) => {
    for (const [route, canonical, locale, alternateLocale] of [
      [PAGES.enHome, "https://heshamorabi.com/", "en_SA", "ar_SA"],
      [PAGES.arHome, "https://heshamorabi.com/ar/", "ar_SA", "en_SA"],
      [PAGES.enPrivacy, "https://heshamorabi.com/privacy/", "en_SA", "ar_SA"],
      [PAGES.arPrivacy, "https://heshamorabi.com/ar/privacy/", "ar_SA", "en_SA"]
    ]) {
      await page.goto(route);
      const metadata = await page.evaluate(() => {
        const content = (selector) =>
          document.querySelector(selector) && document.querySelector(selector).getAttribute("content");
        const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].map(
          (heading) => Number(heading.tagName.slice(1))
        );
        return {
          title: document.title,
          description: content('meta[name="description"]'),
          canonical: document.querySelector('link[rel="canonical"]').href,
          h1Count: document.querySelectorAll("h1").length,
          headings,
          missingAlt: [...document.images]
            .filter((image) => !image.hasAttribute("alt"))
            .map((image) => image.getAttribute("src")),
          ogTitle: content('meta[property="og:title"]'),
          ogDescription: content('meta[property="og:description"]'),
          ogUrl: content('meta[property="og:url"]'),
          ogImage: content('meta[property="og:image"]'),
          ogImageAlt: content('meta[property="og:image:alt"]'),
          ogLocale: content('meta[property="og:locale"]'),
          ogAlternateLocale: content('meta[property="og:locale:alternate"]'),
          twitterCard: content('meta[name="twitter:card"]'),
          twitterTitle: content('meta[name="twitter:title"]'),
          twitterDescription: content('meta[name="twitter:description"]'),
          twitterImage: content('meta[name="twitter:image"]'),
          twitterImageAlt: content('meta[name="twitter:image:alt"]')
        };
      });

      expect(metadata.title.length).toBeGreaterThanOrEqual(10);
      expect(metadata.title.length).toBeLessThanOrEqual(65);
      expect(metadata.description.length).toBeGreaterThanOrEqual(50);
      expect(metadata.description.length).toBeLessThanOrEqual(170);
      expect(metadata.canonical).toBe(canonical);
      expect(metadata.h1Count).toBe(1);
      expect(metadata.missingAlt).toEqual([]);
      for (let index = 1; index < metadata.headings.length; index += 1) {
        expect(metadata.headings[index] - metadata.headings[index - 1]).toBeLessThanOrEqual(1);
      }
      expect(metadata.ogTitle).toBeTruthy();
      expect(metadata.ogDescription).toBeTruthy();
      expect(metadata.ogUrl).toBe(canonical);
      expect(metadata.ogImage).toMatch(/^https:\/\/heshamorabi\.com\/images\/.+\.jpg\?v=\d+$/);
      expect(metadata.ogImageAlt).toBeTruthy();
      expect(metadata.ogLocale).toBe(locale);
      expect(metadata.ogAlternateLocale).toBe(alternateLocale);
      expect(metadata.twitterCard).toBe("summary_large_image");
      expect(metadata.twitterTitle).toBeTruthy();
      expect(metadata.twitterDescription).toBeTruthy();
      expect(metadata.twitterImage).toBe(metadata.ogImage);
      expect(metadata.twitterImageAlt).toBeTruthy();
    }
  });

  test("homepage H1 text is concise and identifies the person and roles once", async ({ page }) => {
    for (const [route, name, role] of [
      [PAGES.enHome, "Hesham Orabi", "Odoo Techno-Functional Consultant"],
      [PAGES.arHome, "هشام عرابي", "استشاري Odoo تقني ووظيفي"]
    ]) {
      await page.goto(route);
      const text = (await page.locator("h1").textContent()).replace(/\s+/g, " ").trim();
      expect(text).toContain(name);
      expect(text).toContain(role);
      expect(text.split(name)).toHaveLength(2);
      expect(text.split(role)).toHaveLength(2);
    }
  });

  test("JSON-LD parses and uses only schemas supported by visible content", async ({ page }) => {
    for (const route of [PAGES.enHome, PAGES.arHome]) {
      await page.goto(route);
      const data = JSON.parse(
        await page.locator('script[type="application/ld+json"]').textContent()
      );
      const graph = data["@graph"];
      const types = graph.map((node) => node["@type"]);
      expect(types).toEqual(["WebSite", "Person", "WebPage"]);

      const ids = new Set(graph.map((node) => node["@id"]));
      const webpage = graph.find((node) => node["@type"] === "WebPage");
      const person = graph.find((node) => node["@type"] === "Person");
      expect(ids.has(webpage.isPartOf["@id"])).toBe(true);
      expect(ids.has(webpage.about["@id"])).toBe(true);
      expect(person.sameAs).toEqual([
        "https://www.linkedin.com/in/orabiofficial/",
        "https://x.com/officialOrabi"
      ]);
      expect(JSON.stringify(data)).not.toContain("ProfessionalService");
      expect(JSON.stringify(data)).not.toContain("BreadcrumbList");
    }

    for (const route of [PAGES.enPrivacy, PAGES.arPrivacy]) {
      await page.goto(route);
      const data = JSON.parse(
        await page.locator('script[type="application/ld+json"]').textContent()
      );
      expect(data["@type"]).toBe("WebPage");
      expect(data.isPartOf["@id"]).toBe("https://heshamorabi.com/#website");
    }
  });
});

test.describe("language switching", () => {
  test("homepage switcher maps paths and preserves hashes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${PAGES.enHome}#contact`);
    await page.locator('.header-actions .lang-switch a[data-lang-switch="ar"]').click();
    await expect(page).toHaveURL(/\/ar\/#contact$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.locator('.header-actions .lang-switch a[data-lang-switch="en"]').click();
    await expect(page).toHaveURL(/\/#contact$/);
  });

  test("privacy switcher maps equivalent paths", async ({ page }) => {
    await page.goto(PAGES.enPrivacy);
    await page.locator('.lang-switch a[data-lang-switch="ar"]').click();
    await expect(page).toHaveURL(/\/ar\/privacy\/$/);
    await page.locator('.lang-switch a[data-lang-switch="en"]').click();
    await expect(page).toHaveURL(/\/privacy\/$/);
  });

  test("localized deep links survive refresh and browser history navigation", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${PAGES.enHome}#contact`);
    await page.locator('.header-actions .lang-switch a[data-lang-switch="ar"]').click();
    await expect(page).toHaveURL(/\/ar\/#contact$/);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("#contact h2")).toBeInViewport();

    await page.goBack();
    await expect(page).toHaveURL(/\/#contact$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.goForward();
    await expect(page).toHaveURL(/\/ar\/#contact$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
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
      await expect(page.locator('a[href*="github.com/HeshamOrabi"]')).toHaveCount(0);
      await expect(page.locator('a[href*="instagram.com"]')).toHaveCount(0);
      await expect(page.locator('a[href*="facebook.com"]')).toHaveCount(0);
    });
  }

  test("case studies and recruiter facts are present in both languages", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PAGES.enHome);
    await expect(page.locator("#cases h2")).toHaveText("Selected deliveries with supporting facts");
    await expect(page.locator("#experience h2")).toHaveText("Roles");
    await expect(page.locator("#cases .row-body").first()).toContainText("more than 50 users");
    await expect(page.locator(".about-aside")).toContainText("Riyadh");

    await page.goto(PAGES.arHome);
    await expect(page.locator("#cases h2")).toHaveText("تنفيذات مختارة");
    await expect(page.locator("#experience h2")).toHaveText("وظائف");
    await expect(page.locator("#cases .row-body").first()).toContainText("لأكثر من 50 مستخدمًا");
    await expect(page.locator(".about-aside")).toContainText("الرياض");
  });

  test("section hashes are preserved on the English homepage", async ({ page }) => {
    await page.goto(`${PAGES.enHome}#contact`);
    await expect.poll(async () => page.evaluate(() => window.location.hash)).toBe("#contact");
    await expect(page.locator("#contact h2")).toBeInViewport();
  });

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
        test.skip(
          !["chromium", "firefox", "webkit"].includes(testInfo.project.name),
          "Viewport matrix runs once per desktop browser engine"
        );
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(route);
        await page.evaluate(() => {
          document.getAnimations({ subtree: true }).forEach((animation) => {
            try {
              animation.finish();
            } catch {
              // Infinite marquee animations cannot be finished; reduced motion
              // disables them, so only finite entrance animations settle here.
            }
          });
        });
        const layout = await page.evaluate(() => {
          const doc = document.documentElement;
          const visible = (element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number.parseFloat(style.opacity) > 0.01 &&
              rect.width > 0 &&
              rect.height > 0
            );
          };
          const box = (selector) => {
            const element = document.querySelector(selector);
            if (!element || !visible(element)) return null;
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height
            };
          };
          const content = [
            ...document.querySelectorAll(
              "header a, header button, main h2, main h3, main p, main li, main a, .row, .contact-card, footer a"
            )
          ].filter((element) => visible(element) && !element.closest("[aria-hidden='true']"));
          const clipped = content
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.left < -2 || rect.right > innerWidth + 2;
            })
            .map((element) => element.textContent.trim().replace(/\s+/g, " ").slice(0, 80));
          const textOverflow = content
            .filter(
              (element) =>
                getComputedStyle(element).whiteSpace !== "nowrap" &&
                element.scrollWidth > element.clientWidth + 1
            )
            .map((element) => element.textContent.trim().replace(/\s+/g, " ").slice(0, 80));
          const images = [...document.images].filter(visible).map((image) => ({
            src: image.getAttribute("src"),
            loaded: image.complete && image.naturalWidth > 0,
            objectFit: getComputedStyle(image).objectFit,
            intrinsic: image.naturalWidth / image.naturalHeight,
            rendered: image.getBoundingClientRect().width / image.getBoundingClientRect().height
          }));
          const portraitElement = document.querySelector(".portrait");
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            clipped,
            textOverflow,
            images,
            lang: doc.lang,
            dir: doc.dir || "ltr",
            hero: box(".hero"),
            kicker: box(".role-kicker"),
            portrait: box(".portrait"),
            portraitTransform: portraitElement
              ? getComputedStyle(portraitElement).transform
              : "none",
            menuVisible: Boolean(box("[data-menu-toggle]")),
            languageSwitchVisible: Boolean(box(".header-actions .lang-switch")),
            desktopSocialVisible: Boolean(box(".header-social"))
          };
        });
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
        expect(layout.clipped, `clipped content at ${viewport.name}`).toEqual([]);
        expect(layout.textOverflow, `text overflow at ${viewport.name}`).toEqual([]);
        expect(
          layout.images.filter((image) => !image.loaded),
          `unloaded images at ${viewport.name}`
        ).toEqual([]);
        expect(
          layout.images.filter(
            (image) =>
              image.objectFit === "fill" &&
              Math.abs(image.intrinsic - image.rendered) / image.intrinsic > 0.02
          ),
          `distorted images at ${viewport.name}`
        ).toEqual([]);
        expect(layout.lang).toMatch(label === "ar" ? /^ar/ : /^en/);
        expect(layout.dir).toBe(label === "ar" ? "rtl" : "ltr");
        expect(layout.hero.height).toBeGreaterThanOrEqual(viewport.height - 1);
        expect(layout.hero.height).toBeLessThanOrEqual(viewport.height + 1);
        expect(layout.kicker.top).toBeGreaterThanOrEqual(-1);
        expect(layout.kicker.bottom).toBeLessThanOrEqual(viewport.height + 1);
        expect(layout.portrait.top).toBeGreaterThanOrEqual(-1);
        expect(layout.portrait.top).toBeLessThan(viewport.height);
        expect(layout.menuVisible).toBe(viewport.width < 640);
        expect(layout.languageSwitchVisible).toBe(true);
        expect(layout.desktopSocialVisible).toBe(viewport.width >= 1024);
        if (layout.portraitTransform.startsWith("matrix(")) {
          const scaleX = Number.parseFloat(
            layout.portraitTransform.replace(/^matrix\(/, "").split(",", 1)[0]
          );
          expect(scaleX, "portrait must not be horizontally mirrored").toBeGreaterThanOrEqual(0);
        }
      });
    }
  }
});

test.describe("layout stability", () => {
  test("homepages remain below the CLS good threshold", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "CLS is measured in Chromium only");
    await page.addInitScript(() => {
      window.__qaCls = 0;
      window.__qaClsSupported =
        "PerformanceObserver" in window &&
        PerformanceObserver.supportedEntryTypes.includes("layout-shift");
      if (window.__qaClsSupported) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__qaCls += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      }
    });

    for (const [route, viewport] of [
      [PAGES.enHome, { width: 390, height: 844 }],
      [PAGES.arHome, { width: 390, height: 844 }],
      [PAGES.enHome, { width: 1280, height: 800 }],
      [PAGES.arHome, { width: 1280, height: 800 }]
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(route, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const result = await page.evaluate(() => ({
        supported: window.__qaClsSupported,
        value: window.__qaCls
      }));
      expect(result.supported).toBe(true);
      expect(result.value, `${route} at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(
        0.1
      );
    }
  });
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

  for (const [label, route] of [
    ["english", PAGES.enHome],
    ["arabic", PAGES.arHome]
  ]) {
    test(`${label} mobile controls have accessible names and WCAG 2.2 target sizes`, async ({
      page
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);

      const controls = await page.evaluate(() => {
        const visible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            !element.closest("[hidden]") &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        return [
          ...document.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ]
          .filter(visible)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const name =
              element.getAttribute("aria-label") ||
              element.textContent.trim().replace(/\s+/g, " ") ||
              element.querySelector("img[alt]:not([alt=''])")?.alt ||
              "";
            return { name, width: rect.width, height: rect.height };
          });
      });

      expect(controls.length).toBeGreaterThan(0);
      expect(controls.filter((control) => !control.name)).toEqual([]);
      expect(
        controls.filter((control) => control.width < 24 || control.height < 24)
      ).toEqual([]);
    });

    test(`${label} keyboard focus stays visible and the drawer remains modal`, async ({
      page
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);

      const focusableCount = await page.locator(
        'a[href]:visible, button:not([disabled]):visible, [tabindex]:not([tabindex="-1"]):visible'
      ).count();
      for (let index = 0; index < focusableCount; index += 1) {
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(() => {
          const element = document.activeElement;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            visible:
              rect.bottom > 0 &&
              rect.top < innerHeight &&
              rect.right > 0 &&
              rect.left < innerWidth,
            focusVisible: element.matches(":focus-visible"),
            outlineWidth: Number.parseFloat(style.outlineWidth)
          };
        });
        expect(focus.visible).toBe(true);
        expect(focus.focusVisible).toBe(true);
        expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
      }

      const toggle = page.locator("[data-menu-toggle]");
      await toggle.click();
      await expect(page.locator("[data-drawer-close]")).toBeFocused();
      await expect(page.locator("main")).toHaveJSProperty("inert", true);

      await page.keyboard.press("Shift+Tab");
      await expect(page.locator(".drawer-social a").last()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator("[data-drawer-close]")).toBeFocused();

      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
      await expect(page.locator("main")).toHaveJSProperty("inert", false);
    });
  }
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

  test("GA4 initializes once with privacy-preserving page-view configuration", async ({ page }) => {
    await enableLocalAnalytics(page);

    for (const route of [PAGES.enHome, PAGES.arHome]) {
      await page.goto(route);
      const commands = await page.evaluate(() =>
        (window.dataLayer || []).map((entry) => Array.from(entry))
      );
      const jsCommands = commands.filter((entry) => entry[0] === "js");
      const configs = commands.filter((entry) => entry[0] === "config");
      expect(jsCommands).toHaveLength(1);
      expect(configs).toHaveLength(1);
      expect(configs[0][1]).toBe("G-22RTPBC0SD");
      expect(configs[0][2]).toMatchObject({
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_expires: 7776000,
        cookie_flags: "SameSite=Lax;Secure",
        cookie_update: false
      });
    }
  });

  test("contact, profile, navigation, and language clicks emit one private event", async ({
    page
  }) => {
    await enableLocalAnalytics(page);

    for (const [route, language, switchLanguage] of [
      [PAGES.enHome, "en", "ar"],
      [PAGES.arHome, "ar", "en"]
    ]) {
      await page.goto(route);
      await page.evaluate(() => {
        window.dataLayer = [];
      });

      await clickWithoutNavigation(page.locator('a[href="mailto:Dev@heshamorabi.com"]').first());
      await clickWithoutNavigation(page.locator('a[href="https://wa.me/966537116359"]').first());
      await clickWithoutNavigation(
        page.locator('a[href="https://www.linkedin.com/in/orabiofficial/"]').first()
      );
      await clickWithoutNavigation(page.locator('a[href="https://x.com/officialOrabi"]').first());
      await clickWithoutNavigation(page.locator('a[href^="#"]:not([href="#"])').first());
      await clickWithoutNavigation(
        page.locator(`a[data-lang-switch="${switchLanguage}"]`).first()
      );
      await page.evaluate(() => {
        const phone = document.createElement("a");
        phone.href = "tel:+000000000";
        phone.textContent = "Phone";
        document.body.appendChild(phone);
        phone.addEventListener("click", (event) => event.preventDefault(), { once: true });
        phone.click();
        phone.remove();
      });

      const events = await getAnalyticsEvents(page);
      const names = events.map((event) => event.name);
      expect(names.filter((name) => name === "email_click")).toHaveLength(1);
      expect(names.filter((name) => name === "whatsapp_click")).toHaveLength(1);
      expect(names.filter((name) => name === "linkedin_click")).toHaveLength(1);
      expect(names.filter((name) => name === "external_profile_click")).toHaveLength(1);
      expect(names.filter((name) => name === "navigation_click")).toHaveLength(1);
      expect(names.filter((name) => name === "language_switch")).toHaveLength(1);
      expect(names.filter((name) => name === "phone_click")).toHaveLength(1);
      expect(
        events.filter((event) => event.name === "language_switch")[0].parameters
      ).toMatchObject({
        page_language: language,
        language_from: language,
        language_to: switchLanguage
      });
      expect(
        events.filter((event) => event.name === "whatsapp_click")[0].parameters
      ).toMatchObject({
        page_language: language,
        contact_region: "saudi_arabia"
      });

      const serialized = JSON.stringify(events);
      expect(serialized).not.toContain("Dev@heshamorabi.com");
      expect(serialized).not.toContain("966537116359");
      expect(serialized).not.toContain("+000000000");
    }
  });

  test("scroll depth thresholds emit once when crossed repeatedly", async ({ page }) => {
    await enableLocalAnalytics(page);
    await page.goto(PAGES.enHome);
    await page.evaluate(() => {
      window.dataLayer = [];
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(100);

    const depthEvents = (await getAnalyticsEvents(page)).filter(
      (event) => event.name === "scroll_depth"
    );
    expect(depthEvents.map((event) => event.parameters.percent_scrolled)).toEqual([
      25, 50, 75, 90
    ]);
  });

  test("section interactions emit once per section per page load", async ({ page }) => {
    await enableLocalAnalytics(page);
    await page.goto(PAGES.arHome);
    await page.evaluate(() => {
      window.dataLayer = [];
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector("#contact").scrollIntoView();
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      document.querySelector("#top").scrollIntoView();
      document.querySelector("#contact").scrollIntoView();
    });
    await page.waitForTimeout(150);

    const contactViews = (await getAnalyticsEvents(page)).filter(
      (event) =>
        event.name === "section_view" && event.parameters.section_id === "contact"
    );
    expect(contactViews).toHaveLength(1);
    expect(contactViews[0].parameters.page_language).toBe("ar");
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
