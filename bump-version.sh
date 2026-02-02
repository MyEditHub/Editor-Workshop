#!/bin/bash

# Check for flags
RELEASE=false
RETAG=false
VERSION_ARG=""
for arg in "$@"; do
  if [ "$arg" = "--release" ]; then
    RELEASE=true
  elif [ "$arg" = "--retag" ]; then
    RETAG=true
  else
    VERSION_ARG="$arg"
  fi
done

# Handle --retag flag (re-release same version without bumping)
if [ "$RETAG" = true ]; then
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  TAG="v$CURRENT_VERSION"

  echo "🔄 Re-tagging $TAG..."

  # Delete local tag if exists
  if git tag -l | grep -q "^$TAG$"; then
    git tag -d "$TAG"
    echo "  Deleted local tag"
  fi

  # Delete remote tag if exists
  if git ls-remote --tags origin | grep -q "refs/tags/$TAG"; then
    git push origin ":refs/tags/$TAG"
    echo "  Deleted remote tag"
  fi

  # Create and push new tag
  git tag "$TAG"
  git push origin "$TAG"

  echo ""
  echo "🚀 Re-tagged $TAG! Build triggered on GitHub Actions."
  exit 0
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Parse current version into parts
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Determine new version based on argument
case "$VERSION_ARG" in
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEW_VERSION="$MAJOR.$((MINOR + 1)).0"
    ;;
  patch|"")
    NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
    ;;
  *)
    # Assume it's an explicit version number
    NEW_VERSION=$VERSION_ARG
    ;;
esac

echo "🔄 Updating version from $CURRENT_VERSION to $NEW_VERSION..."

# Update package.json
npm version $NEW_VERSION --no-git-tag-version

# Update tauri.conf.json
sed -i '' "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# Update Cargo.toml (in [package] section)
sed -i '' "/^\[package\]/,/^\[/ s/^version = \"[0-9.]*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml

# Update App.tsx - handle both formats
sed -i '' "s/Editor Workshop v[0-9.]*</Editor Workshop v$NEW_VERSION</g" src/App.tsx
sed -i '' "s/v[0-9]\.[0-9]\.[0-9]/v$NEW_VERSION/g" src/App.tsx

# Update Dashboard.tsx
sed -i '' "s/v[0-9]\.[0-9]\.[0-9]/v$NEW_VERSION/g" src/components/Dashboard.tsx

# Update README.md
sed -i '' "s/version-[0-9.]*-blue/version-$NEW_VERSION-blue/g" README.md
sed -i '' "s/v[0-9]\.[0-9]\.[0-9]/v$NEW_VERSION/g" README.md
sed -i '' "s|releases/latest|releases/tag/v$NEW_VERSION|g" README.md

# Update public/changelog.md if it exists
if [ -f "public/changelog.md" ]; then
  TODAY=$(date +%Y-%m-%d)
  # Add new version at the top
  sed -i '' "1a\\
\\
## [$NEW_VERSION] - $TODAY\\
- Version bump to $NEW_VERSION\\
" public/changelog.md
fi

# Update CHANGELOG.md if it exists (root level)
if [ -f "CHANGELOG.md" ]; then
  TODAY=$(date +%Y-%m-%d)
  sed -i '' "/^# Changelog/a\\
\\
## [$NEW_VERSION] - $TODAY\\
- Version bump\\
" CHANGELOG.md
fi

# Regenerate Cargo.lock
cd src-tauri && cargo update -p editors-workshop && cd ..

echo "✅ Successfully updated to version $NEW_VERSION"
echo ""
echo "Updated files:"
echo "  - package.json"
echo "  - src-tauri/tauri.conf.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/Cargo.lock"
echo "  - src/App.tsx"
echo "  - src/components/Dashboard.tsx"
echo "  - README.md"
[ -f "public/changelog.md" ] && echo "  - public/changelog.md"
[ -f "CHANGELOG.md" ] && echo "  - CHANGELOG.md"

# If --release flag is set, commit and push (CI does the actual build)
if [ "$RELEASE" = true ]; then
  echo ""
  echo "📦 Committing..."
  git add .
  git commit -m "Bump version to $NEW_VERSION"

  echo ""
  echo "🏷️  Creating tag..."
  git tag "v$NEW_VERSION"

  echo ""
  echo "📤 Pushing..."
  git push && git push origin "v$NEW_VERSION"

  echo ""
  echo "🚀 Release complete! Version $NEW_VERSION is building on GitHub Actions."
else
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git diff"
  echo "  2. Commit: git add . && git commit -m 'Bump version to $NEW_VERSION'"
  echo "  3. Tag and push: git tag v$NEW_VERSION && git push && git push origin v$NEW_VERSION"
  echo ""
  echo "Or run with --release to automate: ./bump-version.sh $VERSION_ARG --release"
fi

