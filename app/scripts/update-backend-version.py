#!/usr/bin/env python3
import requests
import json
import os
import subprocess

def main():
    # Option 1: Use the latest local git tag as backend version
    try:
        version = subprocess.check_output(['git', 'describe', '--tags', '--abbrev=0']).decode().strip()
    except Exception as e:
        version = 'unknown'
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
