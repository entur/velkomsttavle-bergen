/**
 * React ref callback for SVG <text> label elements.
 *
 * Sets dominant-baseline="central" so that each label's (x, y) coordinate
 * acts as the visual vertical centre of the text rather than the baseline.
 * This mirrors how labels are authored in the source floor-plan repository
 * where (x, y) denotes the centre of the room.
 *
 * @param {SVGTextElement | null} el
 */
export function measureLabelOrigin(el) {
  if (!el) return
  el.setAttribute('dominant-baseline', 'central')
}
