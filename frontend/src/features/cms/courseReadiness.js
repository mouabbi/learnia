// Publish-readiness checklist (CMS-only, computed entirely client-side from
// the course tree already loaded by WorkspacePage — no backend endpoint
// needed since everything checked here is already in `course`). Soft
// warnings only, same spirit as the theme editor's WCAG contrast warnings:
// nothing here blocks saving/publishing, it just flags what's missing —
// like VS Code's red "problem" dots on a file/tab.
export function computeReadiness(course) {
  const empty = { structure: [], content: [], assessments: [], settings: [] }
  if (!course) return empty

  const structure = []
  const content = []
  const assessments = []
  const settings = []

  const modules = course.modules || []
  if (modules.length === 0) {
    structure.push('No modules yet.')
  }

  modules.forEach((m) => {
    const chapters = m.chapters || []
    if (chapters.length === 0) structure.push(`Module "${m.title}" has no chapters yet.`)
    chapters.forEach((c) => {
      const pages = c.pages || []
      if (pages.length === 0) structure.push(`Chapter "${c.title}" has no pages yet.`)
      pages.forEach((p) => {
        if (!p.content || !p.content.trim()) {
          content.push(`Page "${p.title}" has no content yet.`)
        }
      })
    })
  })

  const examQuestionCount = course.finalExam?.questions?.length || 0
  if (!course.finalExam) {
    assessments.push('No final exam yet.')
  } else if (examQuestionCount < 10) {
    assessments.push(`Final exam only has ${examQuestionCount} question(s) — consider adding more.`)
  }

  if (!course.description || !course.description.trim()) {
    settings.push('No course description yet — shown on the learner catalog card.')
  }

  return { structure, content, assessments, settings }
}

export function readinessTotal(readiness) {
  return readiness.structure.length + readiness.content.length + readiness.assessments.length + readiness.settings.length
}
