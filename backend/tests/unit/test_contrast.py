"""
Unit tests for utils/contrast.py's WCAG contrast-ratio math
(16-theming) — pure functions, no DB/client needed.
"""

import pytest

from learnia_backend.exceptions import ValidationAppError
from learnia_backend.utils.contrast import (
    AA_LARGE_TEXT_RATIO,
    AA_NORMAL_TEXT_RATIO,
    check_pair,
    contrast_ratio,
    passes_aa,
)


def test_contrast_ratio_of_black_on_white_is_21_to_1():
    ratio = contrast_ratio("#000000", "#ffffff")
    assert ratio == pytest.approx(21.0, abs=0.01)


def test_contrast_ratio_of_identical_colors_is_1_to_1():
    ratio = contrast_ratio("#4f46e5", "#4f46e5")
    assert ratio == pytest.approx(1.0, abs=0.01)


def test_contrast_ratio_is_order_independent():
    # (lighter+0.05)/(darker+0.05) math must give the same ratio regardless
    # of which color is passed first.
    a_b = contrast_ratio("#000000", "#ffffff")
    b_a = contrast_ratio("#ffffff", "#000000")
    assert a_b == pytest.approx(b_a)


def test_contrast_ratio_accepts_3_digit_shorthand_hex():
    # "#fff" should expand to "#ffffff".
    assert contrast_ratio("#000", "#fff") == pytest.approx(contrast_ratio("#000000", "#ffffff"))


def test_contrast_ratio_accepts_hex_without_leading_hash():
    assert contrast_ratio("000000", "ffffff") == pytest.approx(21.0, abs=0.01)


def test_contrast_ratio_invalid_hex_raises_validation_error():
    with pytest.raises(ValidationAppError):
        contrast_ratio("not-a-color", "#ffffff")


def test_contrast_ratio_wrong_length_hex_raises_validation_error():
    with pytest.raises(ValidationAppError):
        contrast_ratio("#1234", "#ffffff")


def test_passes_aa_true_for_black_on_white_normal_text():
    assert passes_aa("#000000", "#ffffff") is True


def test_passes_aa_false_for_low_contrast_pair():
    # Two similar light grays: contrast ratio well under 4.5:1.
    assert passes_aa("#f0f0f0", "#f5f5f5") is False


def test_passes_aa_large_text_uses_lower_threshold():
    # Pick a pair whose ratio sits between the large (3.0) and normal (4.5)
    # AA thresholds, so large-text passes but normal-text fails.
    hex_a, hex_b = "#8a8a8a", "#ffffff"
    ratio = contrast_ratio(hex_a, hex_b)
    assert AA_LARGE_TEXT_RATIO <= ratio < AA_NORMAL_TEXT_RATIO
    assert passes_aa(hex_a, hex_b, large_text=True) is True
    assert passes_aa(hex_a, hex_b, large_text=False) is False


def test_check_pair_returns_none_when_contrast_passes():
    assert check_pair("text on background", "#000000", "#ffffff") is None


def test_check_pair_returns_warning_string_when_contrast_fails():
    warning = check_pair("accent on light background", "#f0f0f0", "#f5f5f5")
    assert warning is not None
    assert "accent on light background" in warning
    assert "fails AA" in warning


def test_check_pair_warning_includes_the_computed_ratio():
    warning = check_pair("label", "#f0f0f0", "#f5f5f5")
    ratio = contrast_ratio("#f0f0f0", "#f5f5f5")
    assert f"{ratio:.1f}:1" in warning
