#!/usr/bin/env bun

import inquirer from "inquirer";
import { spawn } from "child_process";

async function listMCPServers() {
  return new Promise((resolve, reject) => {
    const childProcess = spawn("claude", ["mcp", "list"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let output = "";
    let error = "";

    childProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    childProcess.stderr.on("data", (data) => {
      error += data.toString();
    });

    childProcess.on("close", (code) => {
      if (code === 0) {
        // Parse the output to extract server names
        try {
          const lines = output.split("\\n").filter((line) => line.trim());
          const servers = [];

          for (const line of lines) {
            // Look for lines that might contain server names
            const match = line.match(/^\\s*[-•*]\\s*([a-zA-Z0-9_-]+)/);
            if (match) {
              servers.push(match[1]);
            } else {
              // Try alternative formats
              const colonMatch = line.match(/^([a-zA-Z0-9_-]+):/);
              if (colonMatch) {
                servers.push(colonMatch[1]);
              }
            }
          }

          resolve(servers);
        } catch (parseError) {
          console.warn(
            "⚠️  Could not parse MCP server list:",
            parseError.message
          );
          resolve([]);
        }
      } else {
        resolve([]);
      }
    });

    childProcess.on("error", (error) => {
      resolve([]);
    });
  });
}

async function removeMCPServer(name) {
  return new Promise((resolve, reject) => {
    console.log(`🗑️  Removing: ${name}`);
    const childProcess = spawn("claude", ["mcp", "remove", name], {
      stdio: "inherit",
    });
    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to remove ${name} (exit code: ${code})`));
      }
    });
    childProcess.on("error", (error) => {
      reject(new Error(`Error removing ${name}: ${error.message}`));
    });
  });
}

async function resetProjectChoices() {
  return new Promise((resolve, reject) => {
    console.log("🔄 Resetting project choices...");
    const childProcess = spawn("claude", ["mcp", "reset-project-choices"], {
      stdio: "inherit",
    });
    childProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`Failed to reset project choices (exit code: ${code})`)
        );
      }
    });
    childProcess.on("error", (error) => {
      reject(new Error(`Error resetting project choices: ${error.message}`));
    });
  });
}

async function main() {
  try {
    console.log("🔄 Starting Claude Code MCP reset process...\\n");

    // 1. Check for existing MCP servers
    console.log("🔍 Scanning for existing MCP servers...");
    const servers = await listMCPServers();

    let hasServersToRemove = servers.length > 0;
    let serversToRemove = [];

    if (hasServersToRemove) {
      console.log(
        `✅ Found ${servers.length} MCP server(s): ${servers.join(", ")}\\n`
      );

      // 2. Ask user what to remove
      const removalOptions = await inquirer.prompt([
        {
          type: "list",
          name: "removalType",
          message: "What would you like to reset?",
          choices: [
            {
              name: "Remove all MCP servers (recommended)",
              value: "all",
              short: "All servers",
            },
            {
              name: "Select specific servers to remove",
              value: "select",
              short: "Select servers",
            },
            {
              name: "Skip server removal (only reset project choices)",
              value: "skip",
              short: "Skip removal",
            },
          ],
        },
      ]);

      if (removalOptions.removalType === "all") {
        serversToRemove = servers;
      } else if (removalOptions.removalType === "select") {
        const serverSelection = await inquirer.prompt([
          {
            type: "checkbox",
            name: "selectedServers",
            message: "Select MCP servers to remove:",
            choices: servers.map((server) => ({
              name: server,
              value: server,
              checked: true,
            })),
            validate: (answer) => {
              if (answer.length === 0) {
                return "You must select at least one server to remove.";
              }
              return true;
            },
          },
        ]);
        serversToRemove = serverSelection.selectedServers;
      } else {
        serversToRemove = [];
      }
    } else {
      console.log("✨ No MCP servers found to remove.\\n");
    }

    // 3. Ask about project choices reset
    const projectChoicesReset = await inquirer.prompt([
      {
        type: "confirm",
        name: "resetChoices",
        message: "Reset project choices (recommended for clean setup)?",
        default: true,
      },
    ]);

    // 4. Show summary and confirm
    if (serversToRemove.length > 0 || projectChoicesReset.resetChoices) {
      console.log("\\n📋 Reset Summary:");
      if (serversToRemove.length > 0) {
        console.log(`   • Servers to remove: ${serversToRemove.join(", ")}`);
      }
      if (projectChoicesReset.resetChoices) {
        console.log("   • Project choices: Will be reset");
      }
      console.log("");

      const confirmation = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: "Proceed with the reset?",
          default: true,
        },
      ]);

      if (!confirmation.proceed) {
        console.log("❌ Reset cancelled by user.");
        return;
      }
    } else {
      console.log("✨ Nothing to reset.");
      return;
    }

    // 5. Perform removal
    if (serversToRemove.length > 0) {
      console.log("\\n🗑️  Removing MCP servers...");

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const server of serversToRemove) {
        try {
          await removeMCPServer(server);
          console.log(`✅ Removed ${server}`);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to remove ${server}: ${error.message}`);
          errors.push({ name: server, error: error.message });
          errorCount++;
        }
      }

      console.log(`\\n📊 Removal summary:`);
      console.log(`✅ Successfully removed: ${successCount}`);
      if (errorCount > 0) {
        console.log(`❌ Failed to remove: ${errorCount}`);
        console.log("\\n❌ Failed servers:");
        errors.forEach(({ name, error }) => {
          console.log(`   • ${name}: ${error}`);
        });
      }
    }

    // 6. Reset project choices
    if (projectChoicesReset.resetChoices) {
      try {
        await resetProjectChoices();
        console.log("✅ Reset project choices");
      } catch (error) {
        console.warn(`⚠️  Could not reset project choices: ${error.message}`);
      }
    }

    console.log("\\n🎉 Reset complete!");
    console.log("\\n💡 Next steps:");
    console.log('   • Run "make setup-claude-code" to configure new servers');
    console.log(
      '   • Or run "make reset-and-setup-claude-code" for a complete fresh setup'
    );
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
