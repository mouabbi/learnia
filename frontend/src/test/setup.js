import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount whatever a test rendered so tests never leak DOM into each other.
afterEach(() => cleanup())
