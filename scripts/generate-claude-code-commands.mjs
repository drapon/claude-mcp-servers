#!/usr/bin/env bun

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import dotenv from "dotenv";

const DIST_DIR = "./dist";
const BASE_PATH = process.cwd();
const ENV_PATH = join(BASE_PATH, ".env");

// Load environment variables from .env file
let envConfig = {};
try {
  const envContent = await readFile(ENV_PATH, "utf-8");
  envConfig = dotenv.parse(envContent);
  console.log("✅ Loaded environment variables from .env file\n");
} catch (error) {
  console.warn(
    "⚠️  Could not load .env file. Some MCP servers may not work properly.\n"
  );
}

async function getAvailableMCPs() {
  try {
    const entries = await readdir(DIST_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    console.error(
      '❌ dist directory not found. Run "make build-individual-mcps" first.'
    );
    process.exit(1);
  }
}

function getRequiredEnvVars(mcpName) {
  const envRequirements = {
    obsidian: ["OBSIDIAN_VAULT_DIR"],
    github: ["GITHUB_TOKEN"],
    "brave-search": ["BRAVE_API_KEY"],
    fetch: ["CUSTOM_USER_AGENT"],
    figma: ["FIGMA_API_KEY"],
    supabase: ["SUPABASE_API_KEY"],
  };

  return envRequirements[mcpName] || [];
}

function generateMCPCommand(name, scope = "local") {
  const serverPath = join(BASE_PATH, "dist", name, "index.ts");

  const args = ["claude", "mcp", "add", name];
  
  // Add environment variables based on MCP requirements
  const requiredEnvVars = getRequiredEnvVars(name);
  const envVarsToSet = {};

  for (const envVar of requiredEnvVars) {
    if (envConfig[envVar]) {
      envVarsToSet[envVar] = envConfig[envVar];
    }
  }

  // Add general environment variables that might be needed
  if (envConfig.HOME_DIR) envVarsToSet.HOME_DIR = envConfig.HOME_DIR;
  if (envConfig.BUN_PATH) envVarsToSet.BUN_PATH = envConfig.BUN_PATH;

  // Build the final command with environment variables
  if (Object.keys(envVarsToSet).length > 0) {
    // Add all environment variables as a single -e flag with space-separated key=value pairs
    const envString = Object.entries(envVarsToSet)
      .map(([key, value]) => {
        // Always quote values for shell compatibility
        return `${key}="${value}"`;
      })
      .join(" ");
    args.push("-e", envString);
  }

  // Add scope if not local
  if (scope !== "local") {
    args.push("-s", scope);
  }

  args.push("bun", "run", serverPath);

  return args.join(" ");
}

function getDescription(mcpName) {
  const descriptions = {
    "brave-search": "Web search and local search capabilities",
    puppeteer: "Web scraping and browser automation",
    "shadcn-ui": "UI component generation and management",
    shell: "Execute shell commands safely",
    filesystem: "File and directory operations",
    fetch: "HTTP requests and web API calls",
    github: "GitHub repository management",
    obsidian: "Obsidian note management",
    git: "Git version control operations",
  };

  return descriptions[mcpName] || "MCP server functionality";
}

async function main() {
  const args = process.argv.slice(2);
  const scope = args[0] || "local";
  const format = args[1] || "bash"; // bash, markdown, json

  console.log("🚀 Generating Claude Code MCP commands...\n");

  // Get available MCP servers
  const mcps = await getAvailableMCPs();

  if (mcps.length === 0) {
    console.log("❌ No MCP servers found in dist directory.");
    console.log('💡 Run "make build-individual-mcps" first.');
    process.exit(1);
  }

  console.log(`✅ Found ${mcps.length} MCP servers\n`);

  if (format === "bash") {
    console.log("# =================================================");
    console.log("# Claude Code MCP Setup Commands");
    console.log(`# Scope: ${scope}`);
    console.log(`# Generated: ${new Date().toISOString()}`);
    console.log("# =================================================\n");

    console.log("# Remove existing MCP servers (optional)");
    mcps.forEach((mcp) => {
      console.log(`claude mcp remove ${mcp}`);
    });

    console.log("\n# Add MCP servers");
    mcps.forEach((mcp) => {
      const command = generateMCPCommand(mcp, scope);
      console.log(`# ${mcp} - ${getDescription(mcp)}`);
      console.log(command);
      console.log("");
    });

    console.log("# Verify installation");
    console.log("claude mcp list");

  } else if (format === "markdown") {
    console.log("# Claude Code MCP Setup Commands\\n");
    console.log(`**Scope:** ${scope}  `);
    console.log(`**Generated:** ${new Date().toISOString()}\\n`);

    console.log("## Remove Existing Servers (Optional)\\n");
    console.log("```bash");
    mcps.forEach((mcp) => {
      console.log(`claude mcp remove ${mcp}`);
    });
    console.log("```\\n");

    console.log("## Add MCP Servers\\n");
    mcps.forEach((mcp) => {
      const command = generateMCPCommand(mcp, scope);
      console.log(`### ${mcp}`);
      console.log(`${getDescription(mcp)}\\n`);
      console.log("```bash");
      console.log(command);
      console.log("```\\n");
    });

    console.log("## Verify Installation\\n");
    console.log("```bash");
    console.log("claude mcp list");
    console.log("```");

  } else if (format === "json") {
    const output = {
      scope,
      generated: new Date().toISOString(),
      mcps: mcps.map((mcp) => ({
        name: mcp,
        description: getDescription(mcp),
        command: generateMCPCommand(mcp, scope),
        removeCommand: `claude mcp remove ${mcp}`,
        requiredEnvVars: getRequiredEnvVars(mcp),
      })),
      verifyCommand: "claude mcp list",
    };
    console.log(JSON.stringify(output, null, 2));
  }

  console.log("\\n💡 Usage:");
  console.log("  Copy and paste the commands above into your terminal");
  console.log("  Or save to a file and execute: bash your-file.sh");
}

// Show help if --help is passed
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🚀 Claude Code MCP Command Generator

Usage:
  bun run scripts/generate-claude-code-commands.mjs [scope] [format]

Arguments:
  scope   - MCP scope: local (default), project, user
  format  - Output format: bash (default), markdown, json

Examples:
  # Generate bash commands with local scope
  bun run scripts/generate-claude-code-commands.mjs

  # Generate commands for project scope
  bun run scripts/generate-claude-code-commands.mjs project

  # Generate markdown documentation
  bun run scripts/generate-claude-code-commands.mjs local markdown

  # Generate JSON output
  bun run scripts/generate-claude-code-commands.mjs user json

Make targets:
  make generate-claude-commands          # Generate bash commands (local scope)
  make generate-claude-commands-project  # Generate bash commands (project scope)
  make generate-claude-commands-user     # Generate bash commands (user scope)
`);
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error generating commands:", error);
  process.exit(1);
});
