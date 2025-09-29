#!/bin/bash
# lfs-helper.sh
#
# Git LFS helper script for Free Dispatcher repository
# Provides common LFS operations and diagnostics
#
# Usage:
#   ./scripts/lfs-helper.sh [command]
#
# Commands:
#   status     - Show LFS status and tracked files
#   install    - Install/reinitialize LFS for this repository
#   track      - Show all tracking patterns
#   migrate    - Help migrate existing large files to LFS
#   clean      - Clean up LFS cache
#   info       - Show LFS configuration and storage info
#   help       - Show this help message

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_lfs_installed() {
    if ! command -v git-lfs &> /dev/null; then
        print_error "Git LFS is not installed!"
        echo "Install instructions:"
        echo "  macOS:        brew install git-lfs"
        echo "  Ubuntu/Debian: sudo apt-get install git-lfs"
        echo "  Windows:      Download from https://git-lfs.github.io/"
        exit 1
    fi
}

show_status() {
    print_header "Git LFS Status"
    
    check_lfs_installed
    
    echo "LFS Version:"
    git lfs version
    echo
    
    echo "Repository LFS Status:"
    git lfs status
    echo
    
    echo "LFS Files in Repository:"
    if git lfs ls-files | head -10; then
        lfs_count=$(git lfs ls-files | wc -l)
        if [ "$lfs_count" -gt 10 ]; then
            echo "... and $(($lfs_count - 10)) more files"
        fi
        if [ "$lfs_count" -eq 0 ]; then
            print_warning "No files are currently stored in LFS"
        fi
    else
        print_warning "No LFS files found"
    fi
    echo
    
    print_success "LFS is properly configured for this repository"
}

install_lfs() {
    print_header "Installing/Initializing Git LFS"
    
    check_lfs_installed
    
    echo "Installing Git LFS hooks..."
    git lfs install
    
    print_success "Git LFS installed and initialized"
    
    if [ ! -f ".gitattributes" ]; then
        print_warning ".gitattributes file not found - LFS tracking patterns missing"
        echo "Run the repository setup to create the .gitattributes file"
    else
        print_success ".gitattributes file exists with LFS patterns"
    fi
}

show_tracking() {
    print_header "Git LFS Tracking Patterns"
    
    check_lfs_installed
    
    echo "Currently tracked patterns:"
    git lfs track
    echo
    
    if [ -f ".gitattributes" ]; then
        echo "LFS patterns in .gitattributes:"
        grep -c "filter=lfs" .gitattributes | xargs echo "Total LFS patterns:"
        print_success ".gitattributes is configured"
    else
        print_warning ".gitattributes file not found"
    fi
}

migrate_files() {
    print_header "LFS Migration Helper"
    
    check_lfs_installed
    
    echo "Checking for large files that might benefit from LFS..."
    echo
    
    echo "Files larger than 1MB (not currently in LFS):"
    find . -type f -size +1M \
        -not -path "./.git/*" \
        -not -path "./node_modules/*" \
        -not -path "./app/node_modules/*" \
        | head -20
    
    echo
    print_warning "Review the files above and consider migrating them to LFS if appropriate"
    echo
    echo "To migrate existing files to LFS:"
    echo "  git lfs migrate import --include=\"*.jpg\" --include=\"*.png\""
    echo "  git lfs migrate import --include=\"path/to/specific/file.ext\""
    echo
    echo "CAUTION: Migration rewrites git history. Coordinate with team members!"
}

clean_lfs() {
    print_header "Cleaning LFS Cache"
    
    check_lfs_installed
    
    echo "Current LFS cache usage:"
    du -sh .git/lfs 2>/dev/null || echo "No LFS cache found"
    
    echo
    echo "Cleaning LFS cache..."
    git lfs prune
    
    print_success "LFS cache cleaned"
}

show_info() {
    print_header "Git LFS Configuration & Info"
    
    check_lfs_installed
    
    echo "Git LFS Version:"
    git lfs version
    echo
    
    echo "LFS Configuration:"
    git config --list | grep lfs || echo "No LFS-specific git config found"
    echo
    
    echo "Repository Info:"
    echo "  Remote: $(git remote get-url origin 2>/dev/null || echo 'No origin remote')"
    echo "  Branch: $(git branch --show-current 2>/dev/null || echo 'Unknown')"
    echo
    
    if [ -f ".gitattributes" ]; then
        tracked_patterns=$(grep -c "filter=lfs" .gitattributes)
        echo "  LFS Patterns: $tracked_patterns"
    else
        echo "  LFS Patterns: 0 (.gitattributes missing)"
    fi
    
    lfs_files=$(git lfs ls-files | wc -l)
    echo "  LFS Files: $lfs_files"
}

show_help() {
    echo "Git LFS Helper for Free Dispatcher"
    echo
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  status     - Show LFS status and tracked files"
    echo "  install    - Install/reinitialize LFS for this repository"
    echo "  track      - Show all tracking patterns"
    echo "  migrate    - Help migrate existing large files to LFS"
    echo "  clean      - Clean up LFS cache"
    echo "  info       - Show LFS configuration and storage info"
    echo "  help       - Show this help message"
    echo
    echo "Examples:"
    echo "  $0 status                    # Check LFS status"
    echo "  $0 install                   # Set up LFS"
    echo "  $0 migrate                   # Find files to migrate"
    echo
    echo "For more information, see docs/GIT_LFS_GUIDE.md"
}

# Main command handling
case "${1:-help}" in
    "status")
        show_status
        ;;
    "install")
        install_lfs
        ;;
    "track")
        show_tracking
        ;;
    "migrate")
        migrate_files
        ;;
    "clean")
        clean_lfs
        ;;
    "info")
        show_info
        ;;
    "help"|"")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo
        show_help
        exit 1
        ;;
esac