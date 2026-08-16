(function () {
  "use strict";

  /*
   * GA4 Measurement ID for heshamorabi.com.
   * Netlify may override this at build time with GA4_MEASUREMENT_ID.
   * Measurement IDs are public client identifiers, not server secrets.
   */
  var GA4_MEASUREMENT_ID = "G-22RTPBC0SD";
  var PRODUCTION_HOSTS = {
    "heshamorabi.com": true,
    "www.heshamorabi.com": true
  };

  if (
    !/^G-[A-Z0-9]+$/i.test(GA4_MEASUREMENT_ID) ||
    !PRODUCTION_HOSTS[window.location.hostname]
  ) {
    return;
  }

  var analyticsLoaded = false;
  var trackingBound = false;

  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  // Expose the same global surface as Google's install snippet.
  window.gtag = gtag;

  function getPageLanguage() {
    var htmlLang = (document.documentElement.lang || "").toLowerCase();
    if (htmlLang.indexOf("ar") === 0) return "ar";
    if (htmlLang.indexOf("en") === 0) return "en";
    return window.location.pathname.indexOf("/ar") === 0 ? "ar" : "en";
  }

  function assign(target, source) {
    var key;
    if (!source) return target;
    for (key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
    return target;
  }

  function getLinkLocation(link) {
    if (link.closest(".drawer")) return "mobile_menu";
    if (link.closest(".contact-card")) return "contact";
    if (
      link.closest(".hero-header") ||
      link.closest(".legal-header") ||
      link.closest(".header-actions") ||
      link.closest(".header-cluster")
    ) {
      return "header";
    }
    return "content";
  }

  function track(eventName, parameters) {
    var payload = {
      page_language: getPageLanguage()
    };
    loadAnalytics();
    gtag("event", eventName, assign(payload, parameters || {}));
  }

  function bindTracking() {
    if (trackingBound) return;
    trackingBound = true;

    document.addEventListener("click", function (event) {
      var target = event.target;
      var link;
      var href;
      var location;
      var isLanguageSwitch;
      var explicit;
      var hreflang;
      var languageTo;
      var languageFrom;
      var region;
      var destination;
      var hostname;
      var platform;
      var domain;
      var externalProfiles;

      if (!target || !target.closest) return;
      link = target.closest("a[href]");
      if (!link) return;

      href = link.getAttribute("href") || "";
      location = getLinkLocation(link);
      isLanguageSwitch =
        link.hasAttribute("data-lang-switch") || Boolean(link.closest(".lang-switch"));

      if (isLanguageSwitch) {
        explicit = link.getAttribute("data-lang-switch");
        hreflang = (link.getAttribute("hreflang") || "").toLowerCase();
        languageTo = explicit || (hreflang.indexOf("ar") === 0 ? "ar" : "en");
        languageFrom = getPageLanguage();
        if (languageTo !== languageFrom) {
          track("language_switch", {
            link_location: location,
            language_from: languageFrom,
            language_to: languageTo
          });
        }
      }

      if (href.indexOf("mailto:") === 0) {
        // Never send mailbox addresses or message content to analytics.
        track("email_click", { link_location: location });
        return;
      }

      if (href.indexOf("tel:") === 0) {
        track("phone_click", { link_location: location });
        return;
      }

      if (href.indexOf("wa.me/") !== -1) {
        region = href.indexOf("966") !== -1 ? "saudi_arabia" : "egypt";
        track("whatsapp_click", {
          link_location: location,
          contact_region: region
        });
        return;
      }

      if (href.indexOf("linkedin.com/") !== -1) {
        track("linkedin_click", { link_location: location });
        return;
      }

      if (href.indexOf("#") === 0) {
        track("navigation_click", {
          link_location: location,
          navigation_target: href.slice(1) || "top"
        });
        return;
      }

      externalProfiles = {
        "github.com": "github",
        "x.com": "x",
        "twitter.com": "x",
        "instagram.com": "instagram",
        "facebook.com": "facebook"
      };

      try {
        destination = new URL(link.href);

        if (destination.origin === window.location.origin) {
          if (!isLanguageSwitch) {
            track("navigation_click", {
              link_location: location,
              navigation_target: destination.pathname + destination.hash
            });
          }
          return;
        }

        hostname = destination.hostname.replace(/^www\./, "");
        platform = "";
        for (domain in externalProfiles) {
          if (
            Object.prototype.hasOwnProperty.call(externalProfiles, domain) &&
            (hostname === domain ||
              hostname.slice(-(domain.length + 1)) === "." + domain)
          ) {
            platform = externalProfiles[domain];
            break;
          }
        }

        if (platform) {
          track("external_profile_click", {
            link_location: location,
            profile_platform: platform
          });
        }
      } catch (error) {
        // Ignore non-URL values; normal link behavior is never interrupted.
      }
    });

    var sentDepths = {};
    var scrollFrame = null;

    function measureScroll() {
      var scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      var percent;
      var depths;
      var i;
      var depth;

      scrollFrame = null;
      if (scrollable <= 0) return;

      percent = Math.round((window.scrollY / scrollable) * 100);
      depths = [25, 50, 75, 90];
      for (i = 0; i < depths.length; i += 1) {
        depth = depths[i];
        if (percent >= depth && !sentDepths[depth]) {
          sentDepths[depth] = true;
          track("scroll_depth", { percent_scrolled: depth });
        }
      }
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!scrollFrame) {
          scrollFrame = requestAnimationFrame(measureScroll);
        }
      },
      { passive: true }
    );

    if ("IntersectionObserver" in window) {
      var viewedSections = {};
      var sectionObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var sectionId = entry.target.id;
            if (!entry.isIntersecting || viewedSections[sectionId]) return;
            viewedSections[sectionId] = true;
            track("section_view", { section_id: sectionId });
            sectionObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.15 }
      );

      document.querySelectorAll("main > section[id]").forEach(function (section) {
        sectionObserver.observe(section);
      });
    }
  }

  function loadAnalytics() {
    var script;

    if (analyticsLoaded) return;
    analyticsLoaded = true;

    script = document.createElement("script");
    script.async = true;
    script.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(GA4_MEASUREMENT_ID);
    document.head.appendChild(script);

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
