#!/usr/bin/env python3
"""Create a clean, allow-listed production bundle for Netlify."""

from pathlib import Path
from html import escape
import os
import re
import shutil


ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

FILES = (
    "index.html",
    "404.html",
    "privacy/index.html",
    "robots.txt",
    "sitemap.xml",
    "site.webmanifest",
    "google89f5d47728259c41.html",
    ".well-known/security.txt",
    "css/main.css",
    "css/no-script.css",
    "css/tokens.css",
    "js/main.js",
    "js/analytics.js",
    "images/hesham-orabi-portrait.webp",
    "images/hesham-orabi-portrait-mobile.webp",
    "images/logo-128.webp",
    "images/logo-256.webp",
    "images/hesham-orabi-social-preview.jpg",
    "images/favicon.ico",
    "images/favicon-48x48.png",
    "images/favicon-32x32.png",
    "images/apple-touch-icon.png",
    "images/icon-192.png",
    "images/icon-512.png",
)


def main() -> None:
    missing = [relative for relative in FILES if not (ROOT / relative).is_file()]
    if missing:
        raise SystemExit(f"Missing production files: {', '.join(missing)}")

    if DIST.exists():
        shutil.rmtree(DIST)

    ga4_id = os.getenv("GA4_MEASUREMENT_ID", "").strip()
    search_console_token = os.getenv("GOOGLE_SITE_VERIFICATION", "").strip()

    if ga4_id and not re.fullmatch(r"G-[A-Z0-9]+", ga4_id, re.IGNORECASE):
        raise SystemExit("GA4_MEASUREMENT_ID must use the G-XXXXXXXXXX format")

    if search_console_token and not re.fullmatch(
        r"[A-Za-z0-9_-]+", search_console_token
    ):
        raise SystemExit("GOOGLE_SITE_VERIFICATION contains unexpected characters")

    for relative in FILES:
        source = ROOT / relative
        destination = DIST / relative
        destination.parent.mkdir(parents=True, exist_ok=True)

        if relative == "js/analytics.js":
            content = source.read_text(encoding="utf-8")
            if ga4_id:
                content = re.sub(
                    r'const GA4_MEASUREMENT_ID = "[^"]*";',
                    f'const GA4_MEASUREMENT_ID = "{ga4_id}";',
                    content,
                    count=1,
                )
            destination.write_text(content, encoding="utf-8")
        elif relative == "index.html":
            verification = ""
            if search_console_token:
                verification = (
                    f'<meta name="google-site-verification" '
                    f'content="{escape(search_console_token, quote=True)}">'
                )
            content = source.read_text(encoding="utf-8").replace(
                "<!-- GOOGLE_SITE_VERIFICATION -->", verification
            )
            destination.write_text(content, encoding="utf-8")
        else:
            shutil.copy2(source, destination)

    deploy_context = os.getenv("CONTEXT", "production").strip()
    if deploy_context in {"deploy-preview", "branch-deploy"}:
        (DIST / "_headers").write_text(
            "/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n",
            encoding="utf-8",
        )

    effective_ga4 = ga4_id
    if not effective_ga4:
        match = re.search(
            r'const GA4_MEASUREMENT_ID = "(G-[A-Z0-9]+)";',
            (ROOT / "js" / "analytics.js").read_text(encoding="utf-8"),
            re.IGNORECASE,
        )
        effective_ga4 = match.group(1) if match else ""

    analytics_status = f"enabled ({effective_ga4})" if effective_ga4 else "disabled"
    search_status = "included" if search_console_token else "not configured"
    print(f"Built {len(FILES)} production files in {DIST}")
    print(f"GA4: {analytics_status}; Search Console verification: {search_status}")
    if deploy_context in {"deploy-preview", "branch-deploy"}:
        print(f"Indexing: disabled for {deploy_context}")


if __name__ == "__main__":
    main()
