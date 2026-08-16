(() => {
  "use strict";

  /*
   * GA4 Measurement ID for heshamorabi.com.
   * Netlify may override this at build time with GA4_MEASUREMENT_ID.
   */
  const GA4_MEASUREMENT_ID = "G-22RTPBC0SD";
  const PRODUCTION_HOSTS = new Set(["heshamorabi.com", "www.heshamorabi.com"]);

  if (
    !/^G-[A-Z0-9]+$/i.test(GA4_MEASUREMENT_ID) ||
    !PRODUCTION_HOSTS.has(window.location.hostname)
  ) {
    return;
  }

  let analyticsLoaded = false;
  let trackingBound = false;

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  // Expose the same global surface as Google's install snippet.
  window.gtag = gtag;

  function getLinkLocation(link) {
    if (link.closest(".header-social")) return "header";
    if (link.closest(".drawer")) return "mobile_menu";
    if (link.closest(".contact-card")) return "contact";
    return "content";
  }

  function track(eventName, parameters = {}) {
    loadAnalytics();
    gtag("event", eventName, parameters);
  }

  function bindTracking() {
    if (trackingBound) return;
    trackingBound = true;

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link) return;

      const href = link.getAttribute("href") || "";
      const location = getLinkLocation(link);

      if (href.startsWith("mailto:")) {
        track("email_click", { link_location: location });
        return;
      }

      if (href.includes("wa.me/")) {
        const region = href.includes("966") ? "saudi_arabia" : "egypt";
        track("whatsapp_click", { link_location: location, contact_region: region });
        return;
      }

      if (href.includes("linkedin.com/")) {
        track("linkedin_click", { link_location: location });
        return;
      }

      if (href.startsWith("#")) {
        track("navigation_click", {
          link_location: location,
          navigation_target: href.slice(1) || "top"
        });
        return;
      }

      const externalProfiles = {
        "github.com": "github",
        "x.com": "x",
        "twitter.com": "x",
        "instagram.com": "instagram",
        "facebook.com": "facebook"
      };

      try {
        const destination = new URL(link.href);

        if (destination.origin === window.location.origin) {
          track("navigation_click", {
            link_location: location,
            navigation_target: `${destination.pathname}${destination.hash}`
          });
          return;
        }

        const hostname = destination.hostname.replace(/^www\./, "");
        const platform = Object.entries(externalProfiles).find(([domain]) =>
          hostname.endsWith(domain)
        )?.[1];

        if (platform) {
          track("external_profile_click", {
            link_location: location,
            profile_platform: platform
          });
        }
      } catch {
        // Ignore non-URL values; normal link behavior is never interrupted.
      }
    });

    const sentDepths = new Set();
    let scrollFrame;

    const measureScroll = () => {
      scrollFrame = null;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const percent = Math.round((window.scrollY / scrollable) * 100);
      [25, 50, 75, 90].forEach((depth) => {
        if (percent >= depth && !sentDepths.has(depth)) {
          sentDepths.add(depth);
          track("scroll_depth", { percent_scrolled: depth });
        }
      });
    };

    window.addEventListener(
      "scroll",
      () => {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(measureScroll);
      },
      { passive: true }
    );

    if ("IntersectionObserver" in window) {
      const viewedSections = new Set();
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting || viewedSections.has(entry.target.id)) return;
            viewedSections.add(entry.target.id);
            track("section_view", { section_id: entry.target.id });
            sectionObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.15 }
      );

      document.querySelectorAll("main > section[id]").forEach((section) => {
        sectionObserver.observe(section);
      });
    }
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      GA4_MEASUREMENT_ID
    )}`;
    document.head.append(script);

    gtag("js", new Date());
    gtag("config", GA4_MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: "auto",
      cookie_expires: 60 * 60 * 24 * 90,
      cookie_flags: "SameSite=Lax;Secure",
      cookie_update: false,
      transport_type: "beacon"
    });

    bindTracking();
  }

  loadAnalytics();
})();
