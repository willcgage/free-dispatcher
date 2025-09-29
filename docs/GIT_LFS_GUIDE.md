# Git LFS Setup and Usage Guide

This repository uses Git Large File Storage (LFS) to efficiently handle binary files and large assets. This guide explains how to work with LFS in the Free Dispatcher project.

## What is Git LFS?

Git LFS is an extension that replaces large files with text pointers inside Git, while storing the file contents on a remote server. This keeps your repository lightweight while still allowing version control for binary assets.

## Current Setup

The repository is configured to automatically track these file types with LFS:

### Images
- `*.jpg`, `*.jpeg`, `*.png`, `*.gif`, `*.bmp`, `*.tiff`, `*.webp`, `*.svg`, `*.ico`

### Videos
- `*.mp4`, `*.avi`, `*.mov`, `*.mkv`, `*.wmv`, `*.webm`, `*.flv`

### Audio
- `*.mp3`, `*.wav`, `*.ogg`, `*.flac`, `*.aac`

### Documents & Archives
- `*.pdf`, `*.zip`, `*.tar.gz`, `*.tar.bz2`, `*.7z`, `*.rar`

### Fonts
- `*.ttf`, `*.otf`, `*.woff`, `*.woff2`, `*.eot`

### Executables & Binaries
- `*.exe`, `*.bin`, `*.dmg`, `*.pkg`, `*.deb`, `*.rpm`, `*.msi`, `*.iso`

### Database Files
- `*.db`, `*.sqlite`, `*.sqlite3`

### Large Data Files
- `*.csv`, `*.json`, `*.xml` (only large ones)

### 3D/CAD Files (for model railroad layouts)
- `*.dwg`, `*.dxf`, `*.scad`, `*.stl`, `*.obj`, `*.3mf`

### Log Files
- `*.log` (large log files)

## Prerequisites

Ensure you have Git LFS installed:

```bash
# Check if LFS is installed
git lfs version

# Install on macOS
brew install git-lfs

# Install on Ubuntu/Debian
sudo apt-get install git-lfs

# Install on Windows
# Download from: https://git-lfs.github.io/
```

## Working with LFS Files

### First Time Setup (for new contributors)

When cloning this repository for the first time:

```bash
# Clone the repository (LFS files will be downloaded automatically)
git clone https://github.com/willcgage/free-dispatcher.git
cd free-dispatcher

# Verify LFS is working
git lfs status
```

### Adding New Files

When you add files that match the LFS patterns, they'll automatically be tracked:

```bash
# Add a new image (automatically tracked by LFS)
cp my-layout-photo.jpg app/src/assets/
git add app/src/assets/my-layout-photo.jpg
git commit -m "Add layout photo"
git push
```

### Checking LFS Status

```bash
# See which files are tracked by LFS
git lfs track

# List LFS files in the repository
git lfs ls-files

# Check the status of LFS files
git lfs status
```

### Manual Tracking

If you need to track files not covered by the default patterns:

```bash
# Track a specific file
git lfs track "path/to/large-file.ext"

# Track all files in a directory
git lfs track "docs/assets/*"

# The .gitattributes file will be updated automatically
git add .gitattributes
git commit -m "Track additional files with LFS"
```

## Troubleshooting

### Files Not Being Tracked by LFS

If files that should be tracked by LFS aren't being tracked:

```bash
# Check if the file matches a pattern
git lfs track

# Force LFS tracking for already committed files
git lfs migrate import --include="*.jpg"
```

### LFS Files Not Downloading

If LFS files show as pointers instead of actual content:

```bash
# Download all LFS files
git lfs pull

# Download LFS files for a specific commit
git lfs pull origin main
```

### Bandwidth Limits

GitHub provides 1GB of free LFS storage and 1GB of monthly bandwidth per repository. For more storage:

1. Check current usage: Repository Settings → Billing → Git LFS Data
2. Purchase additional storage if needed
3. Consider alternatives for very large files

## Best Practices

1. **Don't track frequently changing large files** - LFS works best for binary assets that don't change often
2. **Use descriptive commit messages** when adding LFS files
3. **Test LFS setup** before committing large files
4. **Consider file sizes** - files under 100KB might not need LFS
5. **Clean up old LFS files** when they're no longer needed

## Development Workflow

### Adding Assets for the Train Dispatcher App

When adding new assets to the application:

```bash
# For UI assets (logos, icons, etc.)
cp train-icon.png app/src/assets/
cp layout-background.jpg app/public/

# For documentation assets
cp architecture-diagram.png docs/images/

# For sample data or exports
cp sample-layout.json app/fixtures/

# Commit as usual - LFS handles the rest
git add .
git commit -m "Add new train dispatcher assets"
git push
```

## Support

If you encounter issues with LFS:

1. Check the [Git LFS documentation](https://git-lfs.github.io/)
2. Verify your Git LFS installation: `git lfs version`
3. Check repository LFS status: `git lfs status`
4. Contact the project maintainers

---

This LFS setup ensures that binary assets don't bloat the repository while still providing full version control capabilities for all project files.