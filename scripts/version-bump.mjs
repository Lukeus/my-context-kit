#!/usr/bin/env node

/**
 * Version Bump Script
 * 
 * Automatically bumps version numbers across the project following semantic versioning.
 * Updates app/package.json and CHANGELOG.md
 * 
 * Usage:
 *   node scripts/version-bump.mjs [patch|minor|major]
 */

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const PACKAGE_JSON_PATH = join(rootDir, 'app', 'package.json');
const CHANGELOG_PATH = join(rootDir, 'CHANGELOG.md');

/**
 * Parse semantic version string
 */
function parseVersion(versionString) {
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${versionString}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

/**
 * Bump version based on type
 */
function bumpVersion(current, type) {
  const version = parseVersion(current);
  
  switch (type) {
    case 'major':
      version.major += 1;
      version.minor = 0;
      version.patch = 0;
      version.prerelease = null;
      break;
    case 'minor':
      version.minor += 1;
      version.patch = 0;
      version.prerelease = null;
      break;
    case 'patch':
      version.patch += 1;
      version.prerelease = null;
      break;
    default:
      throw new Error(`Invalid bump type: ${type}. Use 'major', 'minor', or 'patch'`);
  }
  
  return version.prerelease
    ? `${version.major}.${version.minor}.${version.patch}-${version.prerelease}`
    : `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Update package.json with new version
 */
async function updatePackageJson(newVersion) {
  const content = await fs.readFile(PACKAGE_JSON_PATH, 'utf-8');
  const pkg = JSON.parse(content);
  const oldVersion = pkg.version;
  
  pkg.version = newVersion;
  
  await fs.writeFile(
    PACKAGE_JSON_PATH,
    JSON.stringify(pkg, null, 2) + '\n',
    'utf-8'
  );
  
  return { oldVersion, newVersion };
}

/**
 * Update CHANGELOG.md with new version section
 */
async function updateChangelog(newVersion) {
  const content = await fs.readFile(CHANGELOG_PATH, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  
  // Find the [Unreleased] section and replace it
  const unreleasedRegex = /## \[Unreleased\]\n\n([\s\S]*?)(?=\n## \[|$)/;
  const match = content.match(unreleasedRegex);
  
  if (!match) {
    console.warn('⚠️  No [Unreleased] section found in CHANGELOG.md');
    return false;
  }
  
  const unreleasedContent = match[1].trim();
  
  if (!unreleasedContent) {
    console.warn('⚠️  [Unreleased] section is empty. Please add changes to CHANGELOG.md first.');
    return false;
  }
  
  // Create new version section
  const newSection = `## [Unreleased]

## [${newVersion}] - ${today}

${unreleasedContent}`;
  
  const updatedContent = content.replace(unreleasedRegex, newSection);
  
  // Update comparison links at the bottom
  const oldLinks = content.match(/\[Unreleased\]: .+/);
  if (oldLinks) {
    const repo = 'https://github.com/lukeus/my-context-kit';
    const newLinks = `[Unreleased]: ${repo}/compare/v${newVersion}...HEAD
[${newVersion}]: ${repo}/releases/tag/v${newVersion}`;
    
    const finalContent = updatedContent.replace(/\[Unreleased\]: .+/, newLinks);
    await fs.writeFile(CHANGELOG_PATH, finalContent, 'utf-8');
  } else {
    await fs.writeFile(CHANGELOG_PATH, updatedContent, 'utf-8');
  }
  
  return true;
}

/**
 * Main execution
 */
async function main() {
  const bumpType = process.argv[2];
  
  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('❌ Usage: node scripts/version-bump.mjs [patch|minor|major]');
    process.exit(1);
  }
  
  try {
    // Read current version
    const pkgContent = await fs.readFile(PACKAGE_JSON_PATH, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const currentVersion = pkg.version;
    
    // Calculate new version
    const newVersion = bumpVersion(currentVersion, bumpType);
    
    console.log(`📦 Bumping version: ${currentVersion} → ${newVersion}`);
    
    // Update package.json
    await updatePackageJson(newVersion);
    console.log('✅ Updated app/package.json');
    
    // Update CHANGELOG.md
    const changelogUpdated = await updateChangelog(newVersion);
    if (changelogUpdated) {
      console.log('✅ Updated CHANGELOG.md');
    } else {
      console.log('⚠️  CHANGELOG.md not updated (no unreleased changes)');
    }
    
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. Review the changes in app/package.json and CHANGELOG.md');
    console.log('  2. Commit: git add app/package.json CHANGELOG.md');
    console.log(`  3. Commit: git commit -m "chore: bump version to ${newVersion}"`);
    console.log('  4. Tag:    git tag -a v' + newVersion + ' -m "Release v' + newVersion + '"');
    console.log('  5. Push:   git push origin main && git push origin v' + newVersion);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
