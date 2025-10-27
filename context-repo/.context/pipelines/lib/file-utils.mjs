/**
 * Shared file utilities for pipelines
 * Provides common file loading, YAML parsing, and directory traversal functions
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYAML } from 'yaml';

/**
 * Load and parse a YAML file
 * @param {string} filePath - Path to YAML file
 * @returns {object} Parsed YAML content
 * @throws {Error} If file cannot be read or parsed
 */
export function loadYamlFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    return parseYAML(content);
  } catch (error) {
    throw new Error(`Failed to load YAML file ${filePath}: ${error.message}`);
  }
}

/**
 * Recursively get all YAML files in a directory
 * @param {string} dir - Directory path
 * @param {object} options - Options
 * @param {boolean} options.recursive - Recursively search subdirectories (default: true)
 * @param {string[]} options.extensions - File extensions to match (default: ['.yaml', '.yml'])
 * @param {function} options.filter - Optional filter function for files
 * @returns {string[]} Array of file paths
 */
export function getAllYamlFiles(dir, options = {}) {
  const { recursive = true, extensions = ['.yaml', '.yml'], filter } = options;
  const files = [];

  try {
    if (!existsSync(dir)) {
      return files;
    }

    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory() && recursive) {
          files.push(...getAllYamlFiles(fullPath, options));
        } else if (extensions.some(ext => item.endsWith(ext))) {
          if (!filter || filter(fullPath)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip files/directories that can't be accessed
        console.warn(`Warning: Could not access ${fullPath}: ${error.message}`);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
  }

  return files;
}

/**
 * Load all YAML files from a directory and parse them
 * @param {string} dir - Directory path
 * @param {object} options - Options
 * @param {boolean} options.recursive - Recursively search subdirectories
 * @param {function} options.filter - Optional filter function
 * @param {function} options.validate - Optional validation function for parsed content
 * @returns {Array<{file: string, data: object}>} Array of parsed files
 */
export function loadAllYamlFiles(dir, options = {}) {
  const { validate } = options;
  const files = getAllYamlFiles(dir, options);
  const results = [];

  for (const file of files) {
    try {
      const data = loadYamlFile(file);
      
      if (validate && !validate(data)) {
        console.warn(`Warning: Validation failed for ${file}`);
        continue;
      }

      results.push({ file, data });
    } catch (error) {
      console.error(`Error loading ${file}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Load entity by ID from a directory
 * @param {string} dir - Directory path
 * @param {string} id - Entity ID to find
 * @returns {object|null} Parsed entity or null if not found
 */
export function loadEntityById(dir, id) {
  const files = getAllYamlFiles(dir);
  
  for (const file of files) {
    try {
      const data = loadYamlFile(file);
      if (data && data.id === id) {
        return { file, data };
      }
    } catch (error) {
      console.error(`Error loading ${file}: ${error.message}`);
    }
  }

  return null;
}

/**
 * Check if a file exists and is accessible
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists and is accessible
 */
export function fileExists(filePath) {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists and is accessible
 * @param {string} dirPath - Path to check
 * @returns {boolean} True if directory exists and is accessible
 */
export function dirExists(dirPath) {
  try {
    return existsSync(dirPath) && statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get relative path from repo root
 * @param {string} fullPath - Full file path
 * @param {string} repoRoot - Repository root path
 * @returns {string} Relative path
 */
export function getRelativePath(fullPath, repoRoot) {
  return fullPath.replace(repoRoot, '').replace(/^[/\\]/, '');
}
