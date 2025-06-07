// scripts/update-frontend-version.js
const fetch = require('node-fetch');
const fs = require('fs');
const owner = 'YOUR_GITHUB_USERNAME_OR_ORG';
const repo = 'YOUR_REPO_NAME';

async function main() {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
  if (!res.ok) throw new Error('Failed to fetch release');
  const data = await res.json();
  const version = data.tag_name || data.name || 'unknown';
  const versionsPath = 'public/versions.json';
  let versions = {};
  if (fs.existsSync(versionsPath)) {
    versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
  }
  versions.frontend_version = version;
  fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  console.log(`Updated frontend_version to ${version}`);
}
main().catch(e => { console.error(e); process.exit(1); });