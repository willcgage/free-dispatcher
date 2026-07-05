/**
 * Owner-authored module schematic (#122) — the structured track-graph the Module
 * Repository builds and Free-Dispatcher imports. The doc types, parser, and pure
 * feature resolver now live in the shared `@willcgage/module-schematic` package
 * so both apps stay in lock-step; this barrel re-exports them under the
 * historical import path. See docs/module-schematic-format.md.
 */
export * from "@willcgage/module-schematic";
