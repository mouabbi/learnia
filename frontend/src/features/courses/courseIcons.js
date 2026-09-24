import {
  GitBranch,
  Code2,
  Globe,
  FlaskConical,
  BookOpen,
  Rocket,
  Cpu,
  Database,
  Terminal,
  Palette,
} from 'lucide-react'

// Single source of truth for a course's icon-picker options (CMS Settings
// tab, see features/cms/SettingsTab.jsx) and how a course.icon name resolves
// to a component on the learner side (CourseCard.jsx) — kept in one place so
// the two never drift (a name pickable in the CMS that CourseCard doesn't
// know how to render would silently fall back to the generic BookOpen icon).
export const COURSE_ICON_COMPONENTS = {
  GitBranch,
  Code2,
  Globe,
  FlaskConical,
  BookOpen,
  Rocket,
  Cpu,
  Database,
  Terminal,
  Palette,
}

export const COURSE_ICON_NAMES = Object.keys(COURSE_ICON_COMPONENTS)
