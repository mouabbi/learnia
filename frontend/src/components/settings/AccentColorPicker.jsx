import { motion } from 'motion/react'
import { useAccentColor } from '../../hooks/useAccentColor'

// A native color-wheel picker for the app's accent color (see
// hooks/useAccentColor.js for how it's applied/persisted).
export function AccentColorPicker() {
  const { accent, setAccentColor, resetAccent, isDefault } = useAccentColor()

  return (
    <div className="accent-picker">
      <label htmlFor="accent-color" className="accent-picker-label">
        <input
          id="accent-color"
          type="color"
          className="accent-picker-input"
          value={accent}
          onChange={(event) => setAccentColor(event.target.value)}
        />
        <span>Choose your accent color</span>
      </label>

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
  )
}
