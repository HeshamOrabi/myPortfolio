(() => {
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const drawer = document.querySelector("[data-drawer]");
  const backdrop = document.querySelector("[data-drawer-backdrop]");
  const drawerClose = document.querySelector("[data-drawer-close]");
  const year = document.querySelector("[data-year]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktopMedia = window.matchMedia("(min-width: 640px)");
  const pageRegions = document.querySelectorAll("body > .hero, body > main, body > .site-footer");
  let closeTimer;

  // Reloads should always open on the hero, even if a #section hash is left in the URL.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const navEntry = performance.getEntriesByType("navigation")[0];
  const isReload = navEntry?.type === "reload";

  if (isReload && location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }

  if (isReload || !location.hash) {
    window.scrollTo(0, 0);
  }

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  document.querySelectorAll("[data-stagger]").forEach((group) => {
    Array.from(group.children).forEach((child, index) => {
      child.style.setProperty("--reveal-index", String(index));
    });
  });

  // Drawer link stagger mirrors the spec: nav 300 + i*80, socials 550 + i*60
  drawer?.querySelectorAll(".drawer-nav a").forEach((link, i) => {
    link.style.transitionDelay = `${300 + i * 80}ms`;
  });
  drawer?.querySelectorAll(".drawer-social a").forEach((link, i) => {
    link.style.transitionDelay = `${550 + i * 60}ms`;
  });

  const setDrawer = (open, returnFocus = true) => {
    if (!drawer || !backdrop || !menuToggle) return;

    window.clearTimeout(closeTimer);

    if (open) {
      drawer.removeAttribute("hidden");
      backdrop.removeAttribute("hidden");
      pageRegions.forEach((region) => {
        region.inert = true;
      });
      // next frame so the transition runs from the closed transform
      requestAnimationFrame(() => {
        drawer.classList.add("is-open");
        backdrop.classList.add("is-open");
        drawerClose?.focus({ preventScroll: true });
      });
    } else {
      drawer.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      pageRegions.forEach((region) => {
        region.inert = false;
      });
      if (returnFocus) {
        menuToggle.focus({ preventScroll: true });
      }
      closeTimer = window.setTimeout(() => {
        if (!drawer.classList.contains("is-open")) {
          drawer.setAttribute("hidden", "");
          backdrop.setAttribute("hidden", "");
        }
      }, reduceMotion ? 0 : 600);
    }

    menuToggle.setAttribute("aria-expanded", String(open));
    const toggleLabel = menuToggle.querySelector(".visually-hidden");
    if (toggleLabel) {
      toggleLabel.textContent = open ? "Close menu" : "Open menu";
    }
    document.body.classList.toggle("is-locked", open);
  };

  menuToggle?.addEventListener("click", () => {
    setDrawer(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  drawerClose?.addEventListener("click", () => setDrawer(false));
  backdrop?.addEventListener("click", () => setDrawer(false));

  drawer?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setDrawer(false, false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle?.getAttribute("aria-expanded") === "true") {
      setDrawer(false);
      return;
    }

    if (event.key !== "Tab" || menuToggle?.getAttribute("aria-expanded") !== "true" || !drawer) {
      return;
    }

    const focusable = Array.from(
      drawer.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((element) => !element.hasAttribute("hidden"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const handleDesktopChange = (event) => {
    if (event.matches && menuToggle?.getAttribute("aria-expanded") === "true") {
      setDrawer(false, false);
    }
  };

  if (typeof desktopMedia.addEventListener === "function") {
    desktopMedia.addEventListener("change", handleDesktopChange);
  } else {
    // Safari 13 and older expose the legacy MediaQueryList listener API.
    desktopMedia.addListener(handleDesktopChange);
  }

  const revealItems = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  revealItems.forEach((el) => observer.observe(el));
})();
