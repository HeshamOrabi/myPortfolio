#!/usr/bin/env python3
"""Firefox responsive/RTL QA for the built static portfolio.

Uses Firefox through geckodriver and WebDriver BiDi so the content viewport is
set exactly. The script intentionally does not represent Safari, iOS, Android,
or physical-device testing.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


HOME_VIEWPORTS = [
    ("w320", 320, 700),
    ("w359", 359, 800),
    ("w360", 360, 800),
    ("w375", 375, 812),
    ("phone-portrait", 390, 844),
    ("w414", 414, 896),
    ("w430", 430, 932),
    ("w479", 479, 900),
    ("w480", 480, 900),
    ("w481", 481, 900),
    ("w600", 600, 960),
    ("w639", 639, 900),
    ("w640", 640, 900),
    ("w641", 641, 900),
    ("w700", 700, 900),
    ("w767", 767, 1024),
    ("tablet-portrait", 768, 1024),
    ("w769", 769, 1024),
    ("w800", 800, 1000),
    ("w820", 820, 1180),
    ("tablet-large-portrait", 834, 1194),
    ("phone-landscape", 844, 390),
    ("tablet-landscape", 1024, 768),
    ("tablet-large-landscape", 1194, 834),
    ("w1280", 1280, 800),
    ("w1366", 1366, 768),
    ("w1439", 1439, 900),
    ("w1440", 1440, 900),
    ("w1441", 1441, 900),
    ("w1536", 1536, 864),
    ("w1600", 1600, 900),
    ("w1728", 1728, 1117),
    ("w1920", 1920, 1080),
    ("w2560", 2560, 1440),
    ("w3440", 3440, 1440),
    ("w3840", 3840, 2160),
]

RELATED_VIEWPORTS = [
    ("narrow", 320, 700),
    ("phone", 390, 844),
    ("short-landscape", 844, 390),
    ("tablet", 768, 1024),
    ("desktop", 1280, 800),
    ("wide", 1920, 1080),
]

SCREENSHOT_VIEWPORTS = {
    "phone-portrait",
    "phone-landscape",
    "tablet-portrait",
    "tablet-large-landscape",
    "w1920",
    "w3440",
}

LAYOUT_SCRIPT = r"""
const routeType = arguments[0];
const px = value => Number.parseFloat(value) || 0;
const visible = element => {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" &&
    px(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0;
};
const rect = selector => {
  const element = document.querySelector(selector);
  if (!element || !visible(element)) return null;
  const value = element.getBoundingClientRect();
  return {
    left: value.left, right: value.right, top: value.top,
    bottom: value.bottom, width: value.width, height: value.height
  };
};
const clipped = [];
const selectors = routeType === "home"
  ? "header a, header button, main h2, main h3, main p, main li, main a, .row, .contact-card, footer a"
  : ".legal-header a, .legal-page h1, .legal-page h2, .legal-page p, .legal-page a, .error-content h1, .error-content p, .error-content a";
document.querySelectorAll(selectors).forEach((element, index) => {
  if (!visible(element) || element.closest("[aria-hidden='true']")) return;
  const value = element.getBoundingClientRect();
  if (value.left < -2 || value.right > innerWidth + 2) {
    clipped.push({
      tag: element.tagName.toLowerCase(),
      className: String(element.className || "").slice(0, 80),
      text: String(element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 90),
      left: Math.round(value.left * 10) / 10,
      right: Math.round(value.right * 10) / 10,
      index
    });
  }
});
const images = [...document.images].filter(visible).map(image => {
  const value = image.getBoundingClientRect();
  const intrinsic = image.naturalWidth && image.naturalHeight
    ? image.naturalWidth / image.naturalHeight : 0;
  const rendered = value.width && value.height ? value.width / value.height : 0;
  return {
    src: image.getAttribute("src"),
    loaded: image.complete && image.naturalWidth > 0,
    intrinsic,
    rendered,
    objectFit: getComputedStyle(image).objectFit
  };
});
const brand = rect(".brand");
const chrome = rect(innerWidth < 640 ? ".header-actions" : ".header-cluster");
const overlap = brand && chrome
  ? Math.max(0, Math.min(brand.right, chrome.right) - Math.max(brand.left, chrome.left)) *
    Math.max(0, Math.min(brand.bottom, chrome.bottom) - Math.max(brand.top, chrome.top))
  : 0;
const kicker = rect(".role-kicker");
const portrait = rect(".portrait");
const portraitTransform = document.querySelector(".portrait")
  ? getComputedStyle(document.querySelector(".portrait")).transform : "none";
return {
  viewport: [innerWidth, innerHeight],
  lang: document.documentElement.lang,
  dir: document.documentElement.dir || "ltr",
  rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
  clipped,
  images,
  headerOverlapArea: overlap,
  headerBottom: Math.max(brand ? brand.bottom : 0, chrome ? chrome.bottom : 0),
  kicker,
  portrait,
  portraitTransform,
  menuToggleVisible: Boolean(rect("[data-menu-toggle]")),
  desktopClusterVisible: Boolean(rect(".header-cluster")),
  mainHeight: document.querySelector("main") ? document.querySelector("main").getBoundingClientRect().height : 0
};
"""


class WebSocket:
    def __init__(self, url: str):
        parsed = urlparse(url)
        self.sock = socket.create_connection((parsed.hostname, parsed.port), timeout=30)
        key = base64.b64encode(os.urandom(16)).decode()
        request = (
            f"GET {parsed.path} HTTP/1.1\r\n"
            f"Host: {parsed.hostname}:{parsed.port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(request.encode())
        response = b""
        while b"\r\n\r\n" not in response:
            response += self.sock.recv(4096)
        if b" 101 " not in response.split(b"\r\n", 1)[0]:
            raise RuntimeError(f"WebSocket upgrade failed: {response[:200]!r}")
        self.counter = 0

    def _read(self, size: int) -> bytes:
        data = b""
        while len(data) < size:
            chunk = self.sock.recv(size - len(data))
            if not chunk:
                raise ConnectionError("WebSocket closed")
            data += chunk
        return data

    def call(self, method: str, params: dict) -> dict:
        self.counter += 1
        payload = json.dumps(
            {"id": self.counter, "method": method, "params": params},
            separators=(",", ":"),
        ).encode()
        mask = os.urandom(4)
        header = bytearray([0x81])
        length = len(payload)
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(length.to_bytes(2, "big"))
        else:
            header.append(0x80 | 127)
            header.extend(length.to_bytes(8, "big"))
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        self.sock.sendall(header + mask + masked)

        while True:
            first, second = self._read(2)
            opcode = first & 0x0F
            size = second & 0x7F
            if size == 126:
                size = int.from_bytes(self._read(2), "big")
            elif size == 127:
                size = int.from_bytes(self._read(8), "big")
            remote_mask = self._read(4) if second & 0x80 else None
            body = self._read(size)
            if remote_mask:
                body = bytes(
                    value ^ remote_mask[index % 4] for index, value in enumerate(body)
                )
            if opcode != 1:
                continue
            message = json.loads(body)
            if message.get("id") == self.counter:
                if "error" in message:
                    raise RuntimeError(message)
                return message["result"]


class Driver:
    def __init__(self, port: int, reduced_motion: bool = False):
        self.base = f"http://127.0.0.1:{port}"
        self.process = subprocess.Popen(
            ["geckodriver", "--port", str(port), "--log", "error"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        for _ in range(80):
            try:
                urllib.request.urlopen(f"{self.base}/status", timeout=1)
                break
            except (urllib.error.URLError, TimeoutError):
                time.sleep(0.1)
        else:
            raise RuntimeError("geckodriver did not start")

        value = self.request(
            "POST",
            "/session",
            {
                "capabilities": {
                    "alwaysMatch": {
                        "browserName": "firefox",
                        "webSocketUrl": True,
                        "moz:firefoxOptions": {
                            "args": ["-headless"],
                            "prefs": {
                                "browser.cache.disk.enable": False,
                                "browser.cache.memory.enable": False,
                                "ui.prefersReducedMotion": 1 if reduced_motion else 0,
                            },
                        },
                    }
                }
            },
        )
        self.session = value["sessionId"]
        self.websocket = WebSocket(value["capabilities"]["webSocketUrl"])
        self.context = self.websocket.call("browsingContext.getTree", {})["contexts"][0][
            "context"
        ]

    def request(self, method: str, path: str, data: dict | None = None):
        request = urllib.request.Request(
            self.base + path,
            data=None if data is None else json.dumps(data).encode(),
            method=method,
            headers={"Content-Type": "application/json"},
        )
        response = json.loads(urllib.request.urlopen(request, timeout=60).read())
        return response["value"]

    def viewport(self, width: int, height: int):
        self.websocket.call(
            "browsingContext.setViewport",
            {
                "context": self.context,
                "viewport": {"width": width, "height": height},
                "devicePixelRatio": 1,
            },
        )

    def navigate(self, url: str):
        self.request("POST", f"/session/{self.session}/url", {"url": url})

    def execute(self, script: str, args: list | None = None):
        return self.request(
            "POST",
            f"/session/{self.session}/execute/sync",
            {"script": script, "args": args or []},
        )

    def execute_async(self, script: str, args: list | None = None):
        return self.request(
            "POST",
            f"/session/{self.session}/execute/async",
            {"script": script, "args": args or []},
        )

    def screenshot(self, path: Path):
        encoded = self.request("GET", f"/session/{self.session}/screenshot")
        path.write_bytes(base64.b64decode(encoded))

    def key(self, value: str):
        self.request(
            "POST",
            f"/session/{self.session}/actions",
            {
                "actions": [
                    {
                        "type": "key",
                        "id": "keyboard",
                        "actions": [
                            {"type": "keyDown", "value": value},
                            {"type": "keyUp", "value": value},
                        ],
                    }
                ]
            },
        )
        self.request("DELETE", f"/session/{self.session}/actions")

    def shift_tab(self):
        self.request(
            "POST",
            f"/session/{self.session}/actions",
            {
                "actions": [
                    {
                        "type": "key",
                        "id": "keyboard",
                        "actions": [
                            {"type": "keyDown", "value": "\ue008"},
                            {"type": "keyDown", "value": "\ue004"},
                            {"type": "keyUp", "value": "\ue004"},
                            {"type": "keyUp", "value": "\ue008"},
                        ],
                    }
                ]
            },
        )
        self.request("DELETE", f"/session/{self.session}/actions")

    def close(self):
        try:
            self.request("DELETE", f"/session/{self.session}")
        finally:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()


def assert_layout(metrics: dict, route_type: str, width: int) -> list[str]:
    failures = []
    if metrics["viewport"][0] != width:
        failures.append(f"viewport width is {metrics['viewport'][0]}, expected {width}")
    if metrics["rootOverflow"] > 1 or metrics["bodyOverflow"] > 1:
        failures.append(
            f"horizontal overflow root={metrics['rootOverflow']} body={metrics['bodyOverflow']}"
        )
    if metrics["clipped"]:
        failures.append(f"clipped content: {metrics['clipped'][:4]}")
    unloaded = [image["src"] for image in metrics["images"] if not image["loaded"]]
    if unloaded:
        failures.append(f"unloaded images: {unloaded}")
    distorted = [
        image["src"]
        for image in metrics["images"]
        if image["objectFit"] == "fill"
        and image["intrinsic"]
        and abs(image["intrinsic"] - image["rendered"]) / image["intrinsic"] > 0.02
    ]
    if distorted:
        failures.append(f"distorted images: {distorted}")
    if metrics["headerOverlapArea"] > 1:
        failures.append(f"header controls overlap by {metrics['headerOverlapArea']:.1f}px²")

    if route_type == "home":
        if metrics["mainHeight"] <= 0:
            failures.append("main content has no height")
        expected_mobile = width < 640
        if metrics["menuToggleVisible"] != expected_mobile:
            failures.append("mobile menu visibility does not match the 640px breakpoint")
        if metrics["desktopClusterVisible"] == expected_mobile:
            failures.append("desktop navigation visibility does not match the 640px breakpoint")
        kicker = metrics["kicker"]
        portrait = metrics["portrait"]
        if not kicker or kicker["top"] < -1 or kicker["bottom"] > metrics["viewport"][1] + 1:
            failures.append(f"hero kicker is outside viewport: {kicker}")
        elif kicker["top"] < metrics["headerBottom"] - 1:
            failures.append(
                f"kicker overlaps header ({kicker['top']:.1f}<{metrics['headerBottom']:.1f})"
            )
        if not portrait or portrait["top"] < -1 or portrait["top"] >= metrics["viewport"][1]:
            failures.append(f"portrait start is outside viewport: {portrait}")
        if kicker and portrait and kicker["bottom"] > portrait["top"] + 1:
            failures.append(
                f"kicker overlaps portrait start ({kicker['bottom']:.1f}>{portrait['top']:.1f})"
            )
        transform = metrics["portraitTransform"]
        if transform.startswith("matrix("):
            scale_x = float(transform.removeprefix("matrix(").split(",", 1)[0])
            if scale_x < 0:
                failures.append("portrait is horizontally mirrored")
    return failures


def assert_language(metrics: dict, language: str) -> list[str]:
    if language == "ar":
        failures = []
        if not metrics["lang"].startswith("ar"):
            failures.append(f"Arabic page has unexpected lang={metrics['lang']!r}")
        if metrics["dir"] != "rtl":
            failures.append(f"Arabic page has unexpected dir={metrics['dir']!r}")
        return failures
    failures = []
    if not metrics["lang"].startswith("en"):
        failures.append(f"English page has unexpected lang={metrics['lang']!r}")
    if metrics["dir"] != "ltr":
        failures.append(f"English page has unexpected dir={metrics['dir']!r}")
    return failures


def check_drawer(driver: Driver, width: int, language: str) -> list[str]:
    failures = []
    closed = driver.execute(
        """
        const drawer = document.querySelector("[data-drawer]");
        drawer.removeAttribute("hidden");
        const rect = drawer.getBoundingClientRect();
        const result = {
          left: rect.left, right: rect.right, width: rect.width,
          clientWidth: document.documentElement.clientWidth
        };
        drawer.setAttribute("hidden", "");
        return result;
        """
    )
    if language == "en" and closed["left"] < closed["clientWidth"] - 2:
        failures.append(f"English drawer does not originate from right: {closed}")
    if language == "ar" and closed["right"] > 2:
        failures.append(f"Arabic drawer does not originate from left: {closed}")

    driver.execute('document.querySelector("[data-menu-toggle]").click();')
    time.sleep(0.75)
    opened = driver.execute(
        """
        const drawer = document.querySelector("[data-drawer]");
        const rect = drawer.getBoundingClientRect();
        const focusable = [...drawer.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(element => !element.hasAttribute("hidden"));
        return {
          left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          height: rect.height, viewportHeight: innerHeight,
          first: focusable[0] && focusable[0].className,
          last: focusable.at(-1) && focusable.at(-1).className,
          active: document.activeElement && document.activeElement.className
        };
        """
    )
    if opened["left"] < -1 or opened["right"] > width + 1:
        failures.append(f"open drawer is off-screen: {opened}")
    if abs(opened["height"] - opened["viewportHeight"]) > 1:
        failures.append(f"drawer height does not match dynamic viewport: {opened}")

    driver.execute(
        """
        const drawer = document.querySelector("[data-drawer]");
        const focusable = [...drawer.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(element => !element.hasAttribute("hidden"));
        focusable[0].focus();
        """
    )
    driver.shift_tab()
    # The exact last element is a social link; compare through the focusable list.
    wrapped_back = driver.execute(
        """
        const drawer = document.querySelector("[data-drawer]");
        const focusable = [...drawer.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(element => !element.hasAttribute("hidden"));
        return document.activeElement === focusable.at(-1);
        """
    )
    if not wrapped_back:
        failures.append("Shift+Tab did not wrap focus from first to last drawer control")

    driver.execute(
        """
        const drawer = document.querySelector("[data-drawer]");
        const focusable = [...drawer.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )].filter(element => !element.hasAttribute("hidden"));
        focusable.at(-1).focus();
        """
    )
    driver.key("\ue004")
    wrapped_forward = driver.execute(
        """
        const drawer = document.querySelector("[data-drawer]");
        const first = drawer.querySelector(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        return document.activeElement === first;
        """
    )
    if not wrapped_forward:
        failures.append("Tab did not wrap focus from last to first drawer control")
    driver.key("\ue00c")
    time.sleep(0.1)
    expanded = driver.execute(
        'return document.querySelector("[data-menu-toggle]").getAttribute("aria-expanded")'
    )
    if expanded != "false":
        failures.append("Escape did not close drawer")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:4173")
    parser.add_argument("--output", default=".qa-responsive")
    parser.add_argument("--port", type=int, default=4457)
    args = parser.parse_args()

    output = Path(args.output)
    shots = output / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    results = []
    driver = Driver(args.port)
    try:
        for name, width, height in HOME_VIEWPORTS:
            driver.viewport(width, height)
            for language, route in [("en", "/"), ("ar", "/ar/")]:
                driver.navigate(args.base_url + route)
                time.sleep(0.08)
                # Layout assertions target the settled UI, not intermediate
                # keyframes from the one-second hero entrance.
                driver.execute(
                    """
                    document.querySelectorAll(".anim-fade-in, .anim-rise-in, .anim-fade-up")
                      .forEach(element => element.getAnimations().forEach(animation => {
                        try { animation.finish(); } catch (error) {}
                      }));
                    return null;
                    """
                )
                metrics = driver.execute(LAYOUT_SCRIPT, ["home"])
                failures = assert_layout(metrics, "home", width)
                failures.extend(assert_language(metrics, language))
                if width in (320, 390, 600, 639):
                    failures.extend(check_drawer(driver, width, language))
                if name in SCREENSHOT_VIEWPORTS:
                    time.sleep(1.1)
                    driver.screenshot(shots / f"{name}-{language}.png")
                results.append(
                    {
                        "page": "home",
                        "language": language,
                        "viewport": [width, height],
                        "name": name,
                        "failures": failures,
                        "metrics": metrics,
                    }
                )
                print(
                    f"{'PASS' if not failures else 'FAIL'} home {language} "
                    f"{width}x{height}"
                )

        for name, width, height in RELATED_VIEWPORTS:
            driver.viewport(width, height)
            for language, route in [
                ("en", "/privacy/"),
                ("ar", "/ar/privacy/"),
                ("en", "/404.html"),
                ("ar", "/ar/404.html"),
            ]:
                route_type = "privacy" if "privacy" in route else "404"
                driver.navigate(args.base_url + route)
                time.sleep(0.05)
                driver.execute(
                    """
                    document.querySelectorAll(".anim-fade-in, .anim-rise-in, .anim-fade-up")
                      .forEach(element => element.getAnimations().forEach(animation => {
                        try { animation.finish(); } catch (error) {}
                      }));
                    return null;
                    """
                )
                metrics = driver.execute(LAYOUT_SCRIPT, [route_type])
                failures = assert_layout(metrics, route_type, width)
                failures.extend(assert_language(metrics, language))
                results.append(
                    {
                        "page": route_type,
                        "language": language,
                        "viewport": [width, height],
                        "name": name,
                        "failures": failures,
                        "metrics": metrics,
                    }
                )
                print(
                    f"{'PASS' if not failures else 'FAIL'} {route_type} {language} "
                    f"{width}x{height}"
                )

        # Verify animation and reduced-motion contracts in the actual browser.
        driver.viewport(1280, 800)
        driver.navigate(args.base_url + "/")
        time.sleep(0.1)
        animation = driver.execute(
            """
            const hero = getComputedStyle(document.querySelector(".anim-rise-in")).animationName;
            const marquee = getComputedStyle(document.querySelector(".marquee")).animationName;
            return {hero, marquee, revealReady: document.documentElement.classList.contains("js-reveal")};
            """
        )
        animation_failures = []
        if animation["hero"] == "none" or animation["marquee"] == "none":
            animation_failures.append(f"expected animations are inactive: {animation}")
        if not animation["revealReady"]:
            animation_failures.append("scroll reveal did not initialize")
        results.append(
            {
                "page": "animation-contract",
                "language": "en",
                "viewport": [1280, 800],
                "name": "firefox",
                "failures": animation_failures,
                "metrics": animation,
            }
        )

        # Capture representative below-the-fold sections for manual visual QA.
        for width, height, size_name in [
            (390, 844, "phone"),
            (1280, 800, "desktop"),
        ]:
            driver.viewport(width, height)
            for language, route in [("en", "/"), ("ar", "/ar/")]:
                driver.navigate(args.base_url + route)
                for section_id in ["about", "work", "process", "expertise", "contact"]:
                    driver.execute(
                        f"""
                        const section = document.getElementById({json.dumps(section_id)});
                        document.documentElement.style.scrollBehavior = "auto";
                        window.scrollTo(0, section.offsetTop);
                        document.querySelectorAll(".reveal").forEach(element => {{
                          element.classList.add("is-visible");
                        }});
                        return null;
                        """
                    )
                    time.sleep(0.05)
                    driver.screenshot(
                        shots / f"content-{size_name}-{language}-{section_id}.png"
                    )

        for language, routes in [
            ("en", ["/privacy/", "/404.html"]),
            ("ar", ["/ar/privacy/", "/ar/404.html"]),
        ]:
            driver.viewport(390, 844)
            for route in routes:
                driver.navigate(args.base_url + route)
                page_name = "privacy" if "privacy" in route else "404"
                driver.screenshot(shots / f"page-phone-{language}-{page_name}.png")
    finally:
        driver.close()

    report = {
        "browser": "Firefox headless via geckodriver/WebDriver BiDi",
        "baseUrl": args.base_url,
        "results": results,
    }
    (output / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    failed = [result for result in results if result["failures"]]
    print(f"\n{len(results)} checks; {len(failed)} failed")
    if failed:
        for result in failed:
            print(
                f"- {result['page']} {result['language']} "
                f"{result['viewport']}: {result['failures']}"
            )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
