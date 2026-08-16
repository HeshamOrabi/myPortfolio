#!/usr/bin/env python3
"""Static security + analytics contract checks for the portfolio source."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAILURES: list[str] = []


def fail(message: str) -> None:
    FAILURES.append(message)


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def check_secrets() -> None:
    patterns = {
        "private_key": re.compile(r"BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY"),
        "aws_key": re.compile(r"AKIA[0-9A-Z]{16}"),
        "assigned_secret": re.compile(
            r"(api[_-]?key|secret|password|token)\s*[:=]\s*[\"'][^\"']{8,}",
            re.I,
        ),
    }
    skip_suffixes = {
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".ico",
        ".woff2",
        ".pyc",
        ".lock",
    }
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative.startswith(("dist/", "node_modules/", ".git/", ".qa-responsive/")):
            continue
        if path.suffix.lower() in skip_suffixes:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for name, pattern in patterns.items():
            for match in pattern.finditer(text):
                snippet = match.group(0)
                if "GA4_MEASUREMENT_ID" in snippet:
                    continue
                if "GOOGLE_SITE_VERIFICATION" in snippet:
                    continue
                if "sha256-" in snippet:
                    continue
                fail(f"{relative}: possible {name}: {snippet[:80]}")


def check_frontend_surface() -> None:
    html_files = [
        "index.html",
        "ar/index.html",
        "privacy/index.html",
        "ar/privacy/index.html",
        "404.html",
        "ar/404.html",
    ]
    for relative in html_files:
        text = read(relative)
        if re.search(r"<(form|input|textarea|select)\b", text, re.I):
            fail(f"{relative}: unexpected form control present")
        if re.search(r"\son\w+\s*=", text, re.I):
            fail(f"{relative}: inline event handler attribute found")
        if "javascript:" in text.lower():
            fail(f"{relative}: javascript: URL found")
        if 'style="' in text or "style='" in text:
            fail(f"{relative}: inline style attribute found")


def check_csp_and_headers() -> None:
    policy_block = re.search(
        r'Content-Security-Policy\s*=\s*"(.*?)"',
        read("netlify.toml"),
        re.S,
    )
    if not policy_block:
        fail("netlify.toml: missing Content-Security-Policy")
        return
    csp = policy_block.group(1)
    for banned in ["'unsafe-inline'", "'unsafe-eval'", " *", " data: *"]:
        if banned.strip() in csp and banned != " data: *":
            if banned in {"'unsafe-inline'", "'unsafe-eval'"} and banned in csp:
                fail(f"netlify.toml: CSP contains {banned}")
    if re.search(r"(^|;)\s*\*\s*(;|$)", csp):
        fail("netlify.toml: CSP uses a bare * source")
    if "upgrade-insecure-requests" not in csp:
        fail("netlify.toml: CSP missing upgrade-insecure-requests")
    if "object-src 'none'" not in csp:
        fail("netlify.toml: CSP missing object-src 'none'")
    if "frame-ancestors 'none'" not in csp:
        fail("netlify.toml: CSP missing frame-ancestors 'none'")

    headers = read("netlify.toml")
    for required in [
        "X-Frame-Options = \"DENY\"",
        "X-Content-Type-Options = \"nosniff\"",
        "Referrer-Policy = \"strict-origin-when-cross-origin\"",
        "Permissions-Policy =",
        "Strict-Transport-Security = \"max-age=31536000; includeSubDomains\"",
        "Cross-Origin-Opener-Policy = \"same-origin\"",
        "Cross-Origin-Resource-Policy = \"same-site\"",
    ]:
        if required not in headers:
            fail(f"netlify.toml: missing header setting {required}")


def check_analytics_source() -> None:
    source = read("js/analytics.js")
    for banned in [r"\?\.", r"\?\?", r"catch\s*\{", r"=>", r"\.\.\."]:
        if re.search(banned, source):
            fail(f"js/analytics.js: banned modern syntax matched /{banned}/")

    for required in [
        'GA4_MEASUREMENT_ID = "G-22RTPBC0SD"',
        "PRODUCTION_HOSTS",
        'track("language_switch"',
        'track("email_click"',
        'track("phone_click"',
        'track("whatsapp_click"',
        'track("linkedin_click"',
        'track("scroll_depth"',
        'track("section_view"',
        'track("navigation_click"',
        'track("external_profile_click"',
        "page_language",
        "allow_google_signals: false",
        "allow_ad_personalization_signals: false",
        'cookie_flags: "SameSite=Lax;Secure"',
        "trackingBound",
        "Never send mailbox addresses",
    ]:
        if required not in source:
            fail(f"js/analytics.js: missing contract `{required}`")

    # Ensure mailto tracking does not include the href/address.
    mailto_block = re.search(
        r'if \(href\.indexOf\("mailto:"\) === 0\) \{([\s\S]*?)return;',
        source,
    )
    if not mailto_block:
        fail("js/analytics.js: mailto tracking block missing")
    elif "href" in mailto_block.group(1) and "link_location" not in mailto_block.group(1):
        fail("js/analytics.js: mailto block may send sensitive values")
    elif re.search(r"email\s*:", mailto_block.group(1)):
        fail("js/analytics.js: mailto block appears to send an email parameter")

    if "languageTo !== languageFrom" not in source:
        fail("js/analytics.js: same-language switch guard missing")


def check_privacy_copy() -> None:
    for relative in ["privacy/index.html", "ar/privacy/index.html"]:
        text = read(relative)
        for needle in [
            "no contact form",
            "Advertising signals",
            "90 days",
        ]:
            # Arabic page uses equivalent statements; English needles apply to EN only.
            if relative.startswith("privacy/") and needle not in text:
                fail(f"{relative}: missing privacy assurance `{needle}`")


def check_dependencies() -> None:
    package = json.loads(read("package.json"))
    deps = package.get("dependencies") or {}
    if deps:
        fail(f"package.json unexpectedly declares runtime dependencies: {deps}")
    # Playwright and axe are local test tooling only.
    for name in package.get("devDependencies", {}):
        if name not in {"@playwright/test", "@axe-core/playwright"}:
            fail(f"unexpected devDependency: {name}")


def main() -> int:
    check_secrets()
    check_frontend_surface()
    check_csp_and_headers()
    check_analytics_source()
    check_privacy_copy()
    check_dependencies()

    if FAILURES:
        print(f"FAILED ({len(FAILURES)})")
        for item in FAILURES:
            print(f"- {item}")
        return 1

    print(
        "PASSED: secrets scan, no forms/inline handlers, CSP/header contracts, "
        "analytics privacy/event contracts, privacy copy, dependency surface"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
