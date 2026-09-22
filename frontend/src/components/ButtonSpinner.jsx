// Small spinning ring for inside a button's pending state (e.g. "Enrolling…").
// Uses currentColor so it matches whatever text color the button has.
export function ButtonSpinner() {
  return <span className="btn-spinner" aria-hidden="true" />
}
