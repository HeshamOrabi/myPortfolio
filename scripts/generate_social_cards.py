#!/usr/bin/env python3
"""Generate the bilingual 1200 × 630 social preview cards."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"

WIDTH = 1200
HEIGHT = 630
INK = "#0B0B0B"
CREAM = "#EFEEE9"
MUTED = "#C8C7C2"
RULE = "#777671"

EN_REGULAR = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
EN_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
AR_REGULAR = "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf"
AR_BOLD = "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def base_card() -> Image.Image:
    card = Image.new("RGB", (WIDTH, HEIGHT), INK)

    # The export is an alpha cutout whose discarded matte carries a bright
    # fringe, so it has to be composited through its own mask rather than
    # flattened to RGB. That leaves the ink background continuous behind it.
    portrait = Image.open(IMAGES / "hesham-orabi-portrait.webp").convert("RGBA")
    portrait.thumbnail((520, 760), Image.Resampling.LANCZOS)
    card.paste(portrait, (650, 34), portrait)

    logo = Image.open(IMAGES / "logo-256.webp").convert("RGBA")
    logo.thumbnail((84, 84), Image.Resampling.LANCZOS)
    card.paste(logo, (64, 48), logo)
    return card


def draw_english() -> Image.Image:
    card = base_card()
    draw = ImageDraw.Draw(card)

    draw.text(
        (62, 162),
        "ENG. HESHAM ORABI",
        font=font(EN_BOLD, 43),
        fill=CREAM,
        spacing=0,
    )
    draw.line((62, 226, 608, 226), fill=RULE, width=1)

    draw.text(
        (62, 251),
        "ODOO TECHNO-FUNCTIONAL CONSULTANT",
        font=font(EN_REGULAR, 22),
        fill=CREAM,
    )
    draw.text(
        (62, 289),
        "ERP PROJECT MANAGER",
        font=font(EN_REGULAR, 22),
        fill=MUTED,
    )
    draw.text(
        (62, 348),
        "RIYADH  ·  SAUDI ARABIA  ·  EGYPT  ·  GCC  ·  REMOTE",
        font=font(EN_BOLD, 16),
        fill=CREAM,
    )
    return card


def draw_arabic() -> Image.Image:
    card = base_card()
    draw = ImageDraw.Draw(card)
    right = 608

    draw.text(
        (right, 149),
        "م. هشام عرابي",
        font=font(AR_BOLD, 47),
        fill=CREAM,
        anchor="ra",
        direction="rtl",
        language="ar",
    )
    # Arabic descenders drop well below the baseline, so the rule needs more
    # clearance here than the all-caps English lockup does.
    draw.line((122, 244, right, 244), fill=RULE, width=1)

    draw.text(
        (right, 268),
        "استشاري تقني ووظيفي لأنظمة أودو",
        font=font(AR_REGULAR, 27),
        fill=CREAM,
        anchor="ra",
        direction="rtl",
        language="ar",
    )
    draw.text(
        (right, 313),
        "مدير مشاريع تخطيط موارد المؤسسات",
        font=font(AR_REGULAR, 27),
        fill=MUTED,
        anchor="ra",
        direction="rtl",
        language="ar",
    )
    draw.text(
        (right, 376),
        "الرياض، السعودية، مصر، الخليج، عن بُعد",
        font=font(AR_BOLD, 21),
        fill=CREAM,
        anchor="ra",
        direction="rtl",
        language="ar",
    )
    return card


def save(card: Image.Image, filename: str) -> None:
    card.save(
        IMAGES / filename,
        format="JPEG",
        quality=92,
        optimize=True,
        progressive=True,
        subsampling=0,
    )


def main() -> None:
    save(draw_english(), "hesham-orabi-social-preview.jpg")
    save(draw_arabic(), "hesham-orabi-social-preview-ar.jpg")
    print("Generated English and Arabic social preview cards.")


if __name__ == "__main__":
    main()
