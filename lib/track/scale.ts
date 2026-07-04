/**
 * Scale conversions. A module is built at a modelling scale, so a physical
 * length in inches represents a much longer run of prototype track. The
 * operations model reasons in scale feet (capacity, siding length), so we
 * convert from the module's real inches.
 *
 * Right now this is North American N scale (1:160): 396 real inches → 5280 scale
 * feet = exactly one mile (hence the "One Mile" module).
 */

/** North American N scale ratio (1:160). */
export const N_SCALE_RATIO = 160;

/** Real inches on the module → scale feet of prototype track represented. */
export function inchesToScaleFeet(inches: number, ratio = N_SCALE_RATIO): number {
  return (inches * ratio) / 12;
}

/** Scale feet of prototype track → real inches on the module. */
export function scaleFeetToInches(feet: number, ratio = N_SCALE_RATIO): number {
  return (feet * 12) / ratio;
}
