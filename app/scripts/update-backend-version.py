#!/usr/bin/env python3
import requests
import json
import os

def main():
    owner = 'YOUR_GITHUB_USERNAME_OR_ORG'
    repo = 'YOUR_REPO_NAME'
    api_url = f'https://api.github.com/repos/{owner}/{repo}/releases/latest'
    r = requests.get(api_url)
    if r.status_code != 200:
        raise Exception(f'Failed to fetch release: {r.status_code}')
    data = r.json()
    version = data.get('tag_name') or data.get('name') or 'unknown'
    versions_path = os.path.join(os.path.dirname(__file__), '../public/versions.json')
    if os.path.exists(versions_path):
        with open(versions_path) as f:
            versions = json.load(f)
    else:
        versions = {}
    versions['backend_version'] = version
    with open(versions_path, 'w') as f:
        json.dump(versions, f, indent=2)
    print(f'Updated backend_version to {version}')

if __name__ == '__main__':
    main()
