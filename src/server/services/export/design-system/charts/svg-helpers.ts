/**
 * Math helpers for SVG chart primitives inside @react-pdf/renderer.
 */

/**
 * Build an SVG arc path string for a donut segment.
 *
 * @param cx         center x
 * @param cy         center y
 * @param radius     donut outer radius
 * @param thickness  ring thickness (distance from outer to inner edge)
 * @param startAngle angle in degrees, 0 = 12 o'clock, clockwise
 * @param endAngle   angle in degrees
 */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  startAngle: number,
  endAngle: number
): string {
  const innerR = radius - thickness;
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const sweep = endAngle - startAngle;
  const largeArc = sweep >= 180 ? 1 : 0;

  const x0 = cx + radius * Math.cos(toRad(startAngle));
  const y0 = cy + radius * Math.sin(toRad(startAngle));
  const x1 = cx + radius * Math.cos(toRad(endAngle));
  const y1 = cy + radius * Math.sin(toRad(endAngle));
  const x2 = cx + innerR * Math.cos(toRad(endAngle));
  const y2 = cy + innerR * Math.sin(toRad(endAngle));
  const x3 = cx + innerR * Math.cos(toRad(startAngle));
  const y3 = cy + innerR * Math.sin(toRad(startAngle));

  return [
    `M ${x0} ${y0}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x3} ${y3}`,
    "Z",
  ].join(" ");
}

/**
 * Build a full-ring (track) path for the donut background.
 */
export function fullRingPath(cx: number, cy: number, radius: number, thickness: number): string {
  const innerR = radius - thickness;
  return [
    `M ${cx - radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy}`,
    `M ${cx - innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 1 ${cx + innerR} ${cy}`,
    `A ${innerR} ${innerR} 0 1 1 ${cx - innerR} ${cy}`,
    "Z",
  ].join(" ");
}
