"""
WCAG contrast-ratio checker — the "validate palette, flag if it fails"
utility called for by generated-prompts/16-theming/prompts.md's decision:
"validate and flag with a clear warning + suggested fix, but let the user
make the final call in the theme editor — don't silently auto-mutate
their AI-generated colors."

Pure functions, no DB/IO, so this is trivially unit-testable on its own.
"""

from learnia_backend.exceptions import ValidationAppError

# WCAG 2.x AA thresholds.
AA_NORMAL_TEXT_RATIO = 4.5
AA_LARGE_TEXT_RATIO = 3.0


def _parse_hex(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        raise ValidationAppError(f"Invalid hex color: {hex_color!r}")
    try:
        return (
            int(value[0:2], 16),
            int(value[2:4], 16),
            int(value[4:6], 16),
        )
    except ValueError as exc:
        raise ValidationAppError(f"Invalid hex color: {hex_color!r}") from exc


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    def channel(c: int) -> float:
        c_srgb = c / 255
        return c_srgb / 12.92 if c_srgb <= 0.03928 else ((c_srgb + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast_ratio(hex_a: str, hex_b: str) -> float:
    """WCAG contrast ratio between two colors, in the range [1, 21]."""
    lum_a = _relative_luminance(_parse_hex(hex_a))
    lum_b = _relative_luminance(_parse_hex(hex_b))
    lighter, darker = max(lum_a, lum_b), min(lum_a, lum_b)
    return (lighter + 0.05) / (darker + 0.05)


def passes_aa(hex_a: str, hex_b: str, *, large_text: bool = False) -> bool:
    threshold = AA_LARGE_TEXT_RATIO if large_text else AA_NORMAL_TEXT_RATIO
    return contrast_ratio(hex_a, hex_b) >= threshold


def check_pair(label: str, foreground: str, background: str) -> str | None:
    """
    Returns a human-readable warning string if `foreground` on
    `background` fails AA normal-text contrast, else None. `label`
    describes the pairing (e.g. "accent on light background").
    """
    ratio = contrast_ratio(foreground, background)
    if ratio < AA_NORMAL_TEXT_RATIO:
        return f"{label}: {ratio:.1f}:1, fails AA (needs {AA_NORMAL_TEXT_RATIO}:1)"
    return None
