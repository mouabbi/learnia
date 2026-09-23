import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useAccentColor } from '../../hooks/useAccentColor'

// Curated rebrand options — each reads well as both the light-mode solid
// button color and the dark-mode accent (see useAccentColor/applyAccent,
// which derives --accent-hover/--accent-text from whichever of these, or
// a custom pick, is active).
const PRESET_COLORS = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Slate', hex: '#475569' },
]

// Lets the user rebrand the app: pick one of a few curated presets, or
// fall back to the native color-wheel for a fully custom pick. Both paths
// go through the same useAccentColor hook, which derives a hover shade
// and readable foreground text color for whatever's chosen, so every
// option — preset or custom — stays legible in both light and dark mode.
export function AccentColorPicker() {
  const { accent, setAccentColor, resetAccent, isDefault } = useAccentColor()
  const normalizedAccent = accent.toLowerCase()
  const activePreset = PRESET_COLORS.find((preset) => preset.hex === normalizedAccent)

  return (
    <div className="accent-picker">
      <div className="accent-swatches" role="group" aria-label="Preset accent colors">
        {PRESET_COLORS.map((preset) => {
          const isActive = preset.hex === normalizedAccent
          return (
            <motion.button
              key={preset.hex}
              type="button"
              className={`accent-swatch${isActive ? ' accent-swatch-active' : ''}`}
              style={{ background: preset.hex }}
              onClick={() => setAccentColor(preset.hex)}
              aria-label={preset.name}
              aria-pressed={isActive}
              title={preset.name}
              whileTap={{ scale: 0.9 }}
            >
              {isActive && <Check size={16} aria-hidden="true" />}
            </motion.button>
          )
        })}

        <label
          htmlFor="accent-color"
          className={`accent-swatch accent-swatch-custom${!activePreset ? ' accent-swatch-active' : ''}`}
          title="Custom color"
        >
          <input
            id="accent-color"
            type="color"
            className="accent-swatch-input"
            value={accent}
            onChange={(event) => setAccentColor(event.target.value)}
            aria-label="Custom accent color"
          />
          {!activePreset && <Check size={16} aria-hidden="true" />}
        </label>
      </div>

      <div className="accent-picker-footer">
        <span className="accent-picker-value">{activePreset ? activePreset.name : accent}</span>

        {!isDefault && (
          <motion.button
            type="button"
            className="accent-picker-reset"
            onClick={resetAccent}
            whileTap={{ scale: 0.95 }}
          >
            Reset to default
          </motion.button>
        )}
      </div>
    </div>
  )
}
