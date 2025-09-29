#!/bin/bash
# setup-lfs.sh
#
# Quick setup script for Git LFS in the Free Dispatcher repository
# This script initializes LFS and verifies the configuration
#
# Usage:
#   ./setup-lfs.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Setting up Git LFS for Free Dispatcher...${NC}"
echo

# Check if git-lfs is installed
if ! command -v git-lfs &> /dev/null; then
    echo "❌ Git LFS is not installed!"
    echo
    echo "Install Git LFS first:"
    echo "  macOS:        brew install git-lfs"
    echo "  Ubuntu/Debian: sudo apt-get install git-lfs" 
    echo "  Windows:      Download from https://git-lfs.github.io/"
    exit 1
fi

# Install LFS hooks
echo "📦 Installing Git LFS hooks..."
git lfs install

# Verify .gitattributes exists
if [ ! -f ".gitattributes" ]; then
    echo "❌ .gitattributes file is missing!"
    echo "The repository should include a .gitattributes file with LFS patterns."
    exit 1
fi

echo -e "${GREEN}✅ Git LFS setup complete!${NC}"
echo

echo "📊 Current LFS configuration:"
echo "  LFS Version: $(git lfs version | head -1)"
echo "  Tracked patterns: $(grep -c "filter=lfs" .gitattributes)"
echo "  LFS files: $(git lfs ls-files | wc -l)"
echo

echo "📖 Next steps:"
echo "  • Read the full guide: docs/GIT_LFS_GUIDE.md"
echo "  • Use helper script: ./app/scripts/lfs-helper.sh"
echo "  • Check status: ./app/scripts/lfs-helper.sh status"
echo

echo -e "${GREEN}🚂 Free Dispatcher LFS setup is ready to go!${NC}"