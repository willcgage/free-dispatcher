/**
 * Diff two package snapshots, classifying ADDED keys separately from CHANGED
 * values — the distinction that turned "37/37 modules changed" into a handful
 * of real differences on the 0.71 → 0.147 jump.
 *
 *   node scripts/diff-snapshots.mjs scripts/snap-before.json scripts/snap-after.json
 */
import { readFileSync } from "node:fs";

const [a, b] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, "utf8")));
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

const added = [];
const removed = [];
const changed = [];
for (const id of Object.keys(a.modules)) {
  const A = a.modules[id];
  const B = b.modules[id];
  if (!B) { removed.push(`${id}: gone`); continue; }
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (!(k in A)) { added.push(`${id}.${k}`); continue; }
    if (!(k in B)) { removed.push(`${id}.${k}`); continue; }
    if (!same(A[k], B[k])) changed.push({ id, k, from: A[k], to: B[k] });
  }
}

console.log(`${a.version} → ${b.version}   ${Object.keys(a.modules).length} modules\n`);
console.log(`ADDED keys   : ${added.length}${added.length ? "  " + [...new Set(added.map((s) => s.split(".")[1]))].join(", ") : ""}`);
console.log(`REMOVED keys : ${removed.length}${removed.length ? "  " + removed.join(", ") : ""}`);
console.log(`CHANGED      : ${changed.length} values across ${new Set(changed.map((c) => c.id)).size} modules\n`);

const byField = {};
for (const c of changed) (byField[c.k] ??= []).push(c);
for (const [k, list] of Object.entries(byField)) {
  console.log(`── ${k} — ${list.length} module${list.length === 1 ? "" : "s"}`);
  for (const c of list) {
    const f = JSON.stringify(c.from);
    const t = JSON.stringify(c.to);
    const trim = (s) => (s.length > 150 ? s.slice(0, 150) + "…" : s);
    console.log(`   ${c.id}`);
    console.log(`     was ${trim(f)}`);
    console.log(`     now ${trim(t)}`);
  }
  console.log();
}
if (!changed.length) console.log("no value changed anywhere.");
