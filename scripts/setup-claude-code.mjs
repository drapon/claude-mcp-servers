#!/usr/bin/env bun

import inquirer from "inquirer";
import { spawn } from "child_process";
import { readdir } from "fs/promises";
import { join } from "path";

const DIST_DIR = "./dist";
const BASE_PATH = process.cwd();

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

async function addMCPServer(name, scope = "local") {
  const serverPath = join(BASE_PATH, "dist", name, "index.ts");

  const args = ["mcp", "add"];
  if (scope !== "local") {
    args.push("-s", scope);
  }
  args.push(name, "bun", "run", serverPath);

  return new Promise((resolve, reject) => {
    console.log(`🔧 Running: claude ${args.join(" ")}`);
    const childProcess = spawn("claude", args, { stdio: "inherit" });
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

    // 3. Select scope
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

    // 4. Confirm selection
    console.log("\\n📋 Configuration Summary:");
    console.log(
      `   Selected servers: ${serverSelection.selectedMcps.join(", ")}`
    );
    console.log(`   Scope: ${scopeSelection.scope}`);
    console.log(
      `   Total servers to add: ${serverSelection.selectedMcps.length}\\n`
    );

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

    // 5. Add MCP servers
    console.log("\\n⚡ Adding MCP servers to Claude Code...");

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

    // 6. Show results
    console.log("\\n🎉 Setup complete!");
    console.log(`✅ Successfully added: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ Failed to add: ${errorCount}`);
      console.log("\\n❌ Failed servers:");
      errors.forEach(({ name, error }) => {
        console.log(`   • ${name}: ${error}`);
      });
    }

    console.log("\\n💡 Next steps:");
    console.log("   • Check status with: claude code -> /mcp");
    console.log("   • Or run: make list-claude-code-mcps");

    if (scopeSelection.scope === "project") {
      console.log("   • Commit changes to .mcp.json to share with your team");
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
