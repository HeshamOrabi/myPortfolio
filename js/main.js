(function () {
  "use strict";

  /*
   * Scroll reveal is opt-in: the page ships fully visible and this script adds
   * `js-reveal` only once it is certain it can drive the animation. A parse
   * error, a failed download, or a throw anywhere below therefore degrades to
   * plain visible content instead of a blank page.
   */
  function setupReveal(reduceMotion) {
    var revealItems = document.querySelectorAll(".reveal");
    if (!revealItems.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) return;

    document.documentElement.classList.add("js-reveal");

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    revealItems.forEach(function (el) {
      observer.observe(el);
    });
  }

  function setupChrome(reduceMotion) {
    var menuToggle = document.querySelector("[data-menu-toggle]");
    var drawer = document.querySelector("[data-drawer]");
    var backdrop = document.querySelector("[data-drawer-backdrop]");
    var drawerClose = document.querySelector("[data-drawer-close]");
    var year = document.querySelector("[data-year]");
    var desktopMedia = window.matchMedia("(min-width: 640px)");
    var pageRegions = document.querySelectorAll(
      "body > .skip-link, body > .hero, body > main, body > .site-footer, body > .legal-header, body > .legal-page"
    );
    var closeTimer;

    var openLabel = (menuToggle && menuToggle.dataset.menuOpen) || "Open menu";
    var closeLabel = (menuToggle && menuToggle.dataset.menuClose) || "Close menu";

    // Keep valid section hashes on reload and shared links. Invalid hashes
    // fall back to the top of the page instead of leaving a stale offset.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    var hashId = window.location.hash.replace(/^#/, "");
    var hashTarget = hashId ? document.getElementById(hashId) : null;

    if (hashTarget) {
      window.requestAnimationFrame(function () {
        hashTarget.scrollIntoView();
      });
    } else {
      window.scrollTo(0, 0);
    }

    if (year) {
      year.textContent = String(new Date().getFullYear());
    }

    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      Array.prototype.slice.call(group.children).forEach(function (child, index) {
        child.style.setProperty("--reveal-index", String(index));
      });
    });

    if (drawer) {
      // Drawer link stagger mirrors the spec: nav 300 + i*80, socials 550 + i*60
      drawer.querySelectorAll(".drawer-nav a").forEach(function (link, i) {
        link.style.transitionDelay = 300 + i * 80 + "ms";
      });
      drawer.querySelectorAll(".drawer-social a").forEach(function (link, i) {
        link.style.transitionDelay = 550 + i * 60 + "ms";
      });
    }

    function setDrawer(open, returnFocus) {
      if (!drawer || !backdrop || !menuToggle) return;
      if (returnFocus === undefined) returnFocus = true;

      window.clearTimeout(closeTimer);

      if (open) {
        drawer.removeAttribute("hidden");
        backdrop.removeAttribute("hidden");
        pageRegions.forEach(function (region) {
          region.inert = true;
        });
        // next frame so the transition runs from the closed transform
        requestAnimationFrame(function () {
          drawer.classList.add("is-open");
          backdrop.classList.add("is-open");
          if (drawerClose) drawerClose.focus({ preventScroll: true });
        });
      } else {
        drawer.classList.remove("is-open");
        backdrop.classList.remove("is-open");
        pageRegions.forEach(function (region) {
          region.inert = false;
        });
        if (returnFocus) {
          menuToggle.focus({ preventScroll: true });
        }
        closeTimer = window.setTimeout(
          function () {
            if (!drawer.classList.contains("is-open")) {
              drawer.setAttribute("hidden", "");
              backdrop.setAttribute("hidden", "");
            }
          },
          reduceMotion ? 0 : 600
        );
      }

      menuToggle.setAttribute("aria-expanded", String(open));
      var toggleLabel = menuToggle.querySelector(".visually-hidden");
      if (toggleLabel) {
        toggleLabel.textContent = open ? closeLabel : openLabel;
      }
      document.body.classList.toggle("is-locked", open);
    }

    function drawerIsOpen() {
      return Boolean(menuToggle) && menuToggle.getAttribute("aria-expanded") === "true";
    }

    if (menuToggle) {
      menuToggle.addEventListener("click", function () {
        setDrawer(!drawerIsOpen());
      });
    }

    if (drawerClose) {
      drawerClose.addEventListener("click", function () {
        setDrawer(false);
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        setDrawer(false);
      });
    }

    if (drawer) {
      drawer.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          var href = link.getAttribute("href") || "";
          var isSamePageHash = href.charAt(0) === "#";
          var target = isSamePageHash ? document.getElementById(href.slice(1)) : null;

          // Hash destinations keep focus; external/language links leave the page.
          setDrawer(false, !isSamePageHash);

          if (!target) return;

          window.setTimeout(
            function () {
              if (!target.hasAttribute("tabindex")) {
                target.setAttribute("tabindex", "-1");
              }
              target.focus({ preventScroll: true });
            },
            reduceMotion ? 0 : 600
          );
        });
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && drawerIsOpen()) {
        setDrawer(false);
        return;
      }

      if (event.key !== "Tab" || !drawerIsOpen() || !drawer) {
        return;
      }

      var focusable = Array.prototype.slice
        .call(
          drawer.querySelectorAll(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
        .filter(function (element) {
          return !element.hasAttribute("hidden");
        });
      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    function handleDesktopChange(event) {
      if (event.matches && drawerIsOpen()) {
        setDrawer(false, false);
      }
    }

    if (typeof desktopMedia.addEventListener === "function") {
      desktopMedia.addEventListener("change", handleDesktopChange);
    } else {
      // Safari 13 and older expose the legacy MediaQueryList listener API.
      desktopMedia.addListener(handleDesktopChange);
    }

    // Preserve homepage section hashes when switching languages where possible.
    document.querySelectorAll("[data-lang-switch]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var targetLang = link.getAttribute("data-lang-switch");
        var hash = window.location.hash;
        if (!hash || !targetLang) return;

        try {
          var destination = new URL(link.href, window.location.origin);
          var isHome =
            destination.pathname === "/" ||
            destination.pathname === "/ar/" ||
            destination.pathname === "/ar";
          if (!isHome) return;
          destination.hash = hash;
          event.preventDefault();
          window.location.assign(destination.href);
        } catch (error) {
          // Fall through to normal navigation.
        }
      });
    });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  try {
    setupReveal(reduceMotion);
  } catch (error) {
    document.documentElement.classList.remove("js-reveal");
  }

  try {
    setupChrome(reduceMotion);
  } catch (error) {
    // Navigation and animation polish are optional; content stays readable.
  }
})();
