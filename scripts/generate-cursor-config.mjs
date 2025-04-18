#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Define paths
const __dirname = import.meta.dir;
const projectRoot = path.resolve(__dirname, '..');
const templatePath = path.join(projectRoot, 'cursor_config.template.json');
const outputPath = path.join(projectRoot, 'config.json');

// Check if template file exists
if (!fs.existsSync(templatePath)) {
  console.error(`Template file not found: ${templatePath}`);
  process.exit(1);
}

// Read the template file
let templateContent;
try {
  templateContent = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
  console.error(`Error reading template file: ${error.message}`);
  process.exit(1);
}

// Replace placeholders with values from environment variables
const replacePlaceholders = (content) => {
  // Placeholders to replace
  const replacements = {
    '{{PROJECT_ROOT}}': projectRoot,
    '{{BUN_PATH}}': process.env.BUN_PATH || 'bun',
    '{{HOME_DIR}}': process.env.HOME_DIR || process.env.HOME,
    '{{OBSIDIAN_VAULT_DIR}}': process.env.OBSIDIAN_VAULT_DIR ? JSON.stringify(process.env.OBSIDIAN_VAULT_DIR) : '""',
    '{{BRAVE_API_KEY}}': process.env.BRAVE_API_KEY || '',
    '{{GITHUB_TOKEN}}': process.env.GITHUB_TOKEN || '',
    '{{SUPABASE_API_KEY}}': process.env.SUPABASE_API_KEY || '',
    '{{UVX_PATH}}': process.env.UVX_PATH || 'uvx',
    '{{NPX_PATH}}': process.env.NPX_PATH || 'npx',
    '{{CLAUDE_CLI_PATH}}': process.env.CLAUDE_CLI_PATH || 'claude',
    '{{FIGMA_API_KEY}}': process.env.FIGMA_API_KEY || '',
    '{{CUSTOM_USER_AGENT}}': process.env.CUSTOM_USER_AGENT || '',
    '{{IGNORE_ROBOTS_TXT}}': process.env.IGNORE_ROBOTS_TXT || 'false',
    '{{CURSOR_WORKSPACE_PATH}}': process.env.CURSOR_WORKSPACE_PATH ? JSON.stringify(process.env.CURSOR_WORKSPACE_PATH) : '""',
  };

  // Replace all placeholders
  let result = content;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder, 'g'), value);
  }

  return result;
};

// Apply replacements
const configContent = replacePlaceholders(templateContent);

// Write the output file
try {
  fs.writeFileSync(outputPath, configContent, 'utf8');
  console.log(`Generated Cursor config file: ${outputPath}`);
} catch (error) {
  console.error(`Error writing config file: ${error.message}`);
  process.exit(1);
}
