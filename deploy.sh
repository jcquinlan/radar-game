#!/usr/bin/env bash
set -e

# Build the project
echo "Building..."
npm run build

# Deploy to gh-pages branch
echo "Deploying to GitHub Pages..."
cd dist

git init
git checkout -B gh-pages
git add -A
git commit -m "deploy"
git push -f git@github.com:jcquinlan/radar-game.git gh-pages:gh-pages

cd -
echo "Deployed to https://jcquinlan.github.io/radar-game/"
