// Update frontend_version in public/versions.json using latest GitHub release tag.
import fs from 'fs';
import path from 'path';

async function main() {
  const repoFull = process.env.GITHUB_REPOSITORY || 'willcgage/free-dispatcher';
  const [owner, repo] = repoFull.split('/');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch release: ${res.status} ${body}`);
  }
  const data = await res.json();
  const version = data.tag_name || data.name || 'unknown';

  const versionsPath = path.join(process.cwd(), 'public', 'versions.json');
  let versions = {};
  if (fs.existsSync(versionsPath)) {
    versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));
  }
  versions.frontend_version = version;
  fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2));
  console.log(`Updated frontend_version to ${version}`);
}

main().catch(e => { console.error(e); process.exit(1); });