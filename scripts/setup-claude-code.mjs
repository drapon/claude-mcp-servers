#!/usr/bin/env bun

import inquirer from "inquirer";
import { spawn } from "child_process";
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

async function addMCPServer(name, scope = "local") {
  const serverPath = join(BASE_PATH, "dist", name, "index.ts");

  const args = ["mcp", "add", name];

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
    // For spawn, we need to pass the complete env string as one argument
    const envString = Object.entries(envVarsToSet)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    args.push("-e", envString);
  }

  // Add scope if not local
  if (scope !== "local") {
    args.push("-s", scope);
  }

  args.push("bun", "run", serverPath);

  return new Promise((resolve, reject) => {
    // Create display command with quoted values for logging
    const displayArgs = [...args];
    if (Object.keys(envVarsToSet).length > 0) {
      // Find the -e argument and replace it with quoted version for display
      const eIndex = displayArgs.findIndex(arg => arg === "-e");
      if (eIndex !== -1 && eIndex + 1 < displayArgs.length) {
        const quotedEnvString = Object.entries(envVarsToSet)
          .map(([key, value]) => {
            // Always quote values for display
            return `${key}="${value}"`;
          })
          .join(" ");
        displayArgs[eIndex + 1] = quotedEnvString;
      }
    }
    
    console.log(`🔧 Running: claude ${displayArgs.join(" ")}`);
    const childProcess = spawn("claude", args, {
      stdio: "inherit",
      env: { ...process.env, ...envVarsToSet },
    });
    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to add ${name} (exit code: ${code})`));
      }
    });
  });
}

async function main() {
  try {
    console.log("🚀 Starting Claude Code MCP interactive setup...\n");

    // 1. Get available MCP servers
    console.log("🔍 Scanning for available MCP servers...");
    const mcps = await getAvailableMCPs();

    if (mcps.length === 0) {
      console.log("❌ No MCP servers found in dist directory.");
      console.log('💡 Run "make build-individual-mcps" first.');
      process.exit(1);
    }

    console.log(`✅ Found ${mcps.length} MCP servers\n`);

    // 2. Select MCP servers to add
    const serverSelection = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedMcps",
        message: "Select MCP servers to add to Claude Code:",
        choices: mcps.map((mcp) => ({
          name: `${mcp} - ${getDescription(mcp)}`,
          value: mcp,
          checked: false,
        })),
        pageSize: 15,
        validate: (answer) => {
          if (answer.length === 0) {
            return "You must choose at least one MCP server.";
          }
          return true;
        },
      },
    ]);

    if (serverSelection.selectedMcps.length === 0) {
      console.log("❌ No servers selected. Exiting...");
      return;
    }

    // 3. Check for missing environment variables
    const missingEnvVars = [];

    for (const mcpName of serverSelection.selectedMcps) {
      const requiredVars = getRequiredEnvVars(mcpName);
      for (const envVar of requiredVars) {
        if (!envConfig[envVar]) {
          missingEnvVars.push({ mcp: mcpName, envVar });
        }
      }
    }

    if (missingEnvVars.length > 0) {
      console.log("\n⚠️  Missing environment variables detected:");
      missingEnvVars.forEach(({ mcp, envVar }) => {
        console.log(`   • ${mcp}: ${envVar}`);
      });

      const continueAnyway = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message:
            "Some MCP servers may not work without these variables. Continue anyway?",
          default: false,
        },
      ]);

      if (!continueAnyway.proceed) {
        console.log(
          "❌ Setup cancelled. Please check your .env file and try again."
        );
        return;
      }
    }

    // 4. Select scope
    const scopeSelection = await inquirer.prompt([
      {
        type: "list",
        name: "scope",
        message: "Select scope for the MCP servers:",
        choices: [
          {
            name: "local - Current project only (default)",
            value: "local",
            short: "local",
          },
          {
            name: "project - Shared with team via .mcp.json",
            value: "project",
            short: "project",
          },
          {
            name: "user - All projects globally",
            value: "user",
            short: "user",
          },
        ],
        default: "local",
      },
    ]);

    // 5. Confirm selection
    console.log("\n📋 Configuration Summary:");
    console.log(
      `   Selected servers: ${serverSelection.selectedMcps.join(", ")}`
    );
    console.log(`   Scope: ${scopeSelection.scope}`);
    console.log(
      `   Total servers to add: ${serverSelection.selectedMcps.length}`
    );

    if (missingEnvVars.length > 0) {
      console.log(
        `   ⚠️  Servers with missing env vars: ${[...new Set(missingEnvVars.map((v) => v.mcp))].join(", ")}`
      );
    }
    console.log("");

    const confirmation = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Proceed with adding these MCP servers to Claude Code?",
        default: true,
      },
    ]);

    if (!confirmation.proceed) {
      console.log("❌ Setup cancelled by user.");
      return;
    }

    // 6. Add MCP servers
    console.log("\n⚡ Adding MCP servers to Claude Code...");

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const mcpName of serverSelection.selectedMcps) {
      try {
        await addMCPServer(mcpName, scopeSelection.scope);
        console.log(`✅ Added ${mcpName}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to add ${mcpName}: ${error.message}`);
        errors.push({ name: mcpName, error: error.message });
        errorCount++;
      }
    }

    // 7. Show results
    console.log("\n🎉 Setup complete!");
    console.log(`✅ Successfully added: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ Failed to add: ${errorCount}`);
      console.log("\n❌ Failed servers:");
      errors.forEach(({ name, error }) => {
        console.log(`   • ${name}: ${error}`);
      });
    }

    console.log("\n💡 Next steps:");
    console.log("   • Check status with: claude code -> /mcp");
    console.log("   • Or run: make list-claude-code-mcps");

    if (scopeSelection.scope === "project") {
      console.log(
        "   • Don't forget to commit .mcp.json to version control for team sharing"
      );
    }
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
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

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
