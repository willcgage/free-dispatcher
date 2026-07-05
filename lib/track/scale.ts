/**
 * Scale conversions (N scale, 1:160). These now live in the shared
 * `@willcgage/module-schematic` package so the Module Repository and
 * Free-Dispatcher compute capacity/length identically; this barrel re-exports
 * them under the historical import path.
 */
export { N_SCALE_RATIO, inchesToScaleFeet, scaleFeetToInches } from "@willcgage/module-schematic";
