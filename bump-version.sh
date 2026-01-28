#!/bin/bash

# Check for --release flag
RELEASE=false
VERSION_ARG=""
for arg in "$@"; do
  if [ "$arg" = "--release" ]; then
    RELEASE=true
  else
    VERSION_ARG="$arg"
  fi
done

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

echo "🔄 Updating version to $NEW_VERSION..."

# Update package.json
npm version $NEW_VERSION --no-git-tag-version

# Update tauri.conf.json
sed -i '' "s/\"version\": \"[0-9.]*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json

# Update App.tsx
sed -i '' "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" src/App.tsx

# Update Dashboard.tsx
sed -i '' "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" src/components/Dashboard.tsx

echo "✅ Successfully updated to version $NEW_VERSION"
echo ""
echo "Updated files:"
echo "  - package.json"
echo "  - src-tauri/tauri.conf.json"
echo "  - src/App.tsx"
echo "  - src/components/Dashboard.tsx"

# If --release flag is set, build and commit
if [ "$RELEASE" = true ]; then
  echo ""
  echo "🔨 Building..."
  npm run tauri build

  if [ $? -eq 0 ]; then
    echo ""
    echo "📦 Committing..."
    git add .
    git commit -m "Bump version to $NEW_VERSION"
    echo ""
    echo "🚀 Release complete! Version $NEW_VERSION is ready."
  else
    echo ""
    echo "❌ Build failed. Commit skipped."
    exit 1
  fi
else
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git diff"
  echo "  2. Build: npm run tauri build"
  echo "  3. Commit: git add . && git commit -m 'Bump version to $NEW_VERSION'"
  echo ""
  echo "Or run with --release to automate: npm run bump $VERSION_ARG -- --release"
fi
