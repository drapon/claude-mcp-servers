import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import minimist from 'minimist';

const projectRoot = process.cwd();
const templatePath = path.join(projectRoot, 'claude_desktop_config.template.json');
const customTemplatePath = path.join(projectRoot, 'claude_desktop_config.custom.json');
const envPath = path.join(projectRoot, '.env');

/**
 * Interactive setup for Claude Desktop MCP configuration
 * Allows users to select which MCP servers to enable and customize their settings
 */
async function setupConfig() {
  try {
    console.log('Starting interactive setup for Claude Desktop MCP configuration...');
    
    // 1. Load template file
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const templateJson = JSON.parse(templateContent);
    
    // 2. Load environment variables
    let envConfig = {};
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      envConfig = dotenv.parse(envContent);
    } catch (error) {
      console.warn('Warning: .env file not found or cannot be read. Will create one.');
    }
    
    // 3. Extract the list of MCP servers
    const mcpServers = Object.keys(templateJson.mcpServers);
    
    // 4. Prompt user to select MCPs
    const serverSelections = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'enabledMcps',
        message: 'Select MCP servers to enable:',
        choices: mcpServers.map(server => ({
          name: server,
          checked: !templateJson.mcpServers[server].disabled
        })),
        pageSize: 15
      }
    ]);
    
    // 5. Update template based on selections
    const updatedTemplate = JSON.parse(JSON.stringify(templateJson)); // Deep clone
    
    mcpServers.forEach(server => {
      if (!serverSelections.enabledMcps.includes(server)) {
        // Disable MCPs that were not selected
        updatedTemplate.mcpServers[server].disabled = true;
      } else if (updatedTemplate.mcpServers[server].disabled) {
        // Enable MCPs that were selected but were previously disabled
        updatedTemplate.mcpServers[server].disabled = false;
      }
    });
    
    // 6. Check for missing environment variables for enabled MCPs
    const envVarsNeeded = new Set();
    const requiredEnvVars = {};
    
    // Collect required environment variables
    for (const server of serverSelections.enabledMcps) {
      const mcpConfig = updatedTemplate.mcpServers[server];
      
      // Check for environment variables in args array
      if (mcpConfig.args) {
        mcpConfig.args.forEach(arg => {
          if (typeof arg === 'string' && arg.includes('{{') && arg.includes('}}')) {
            const match = arg.match(/{{([^}]+)}}/);
            if (match && match[1]) {
              const varName = match[1];
              if (varName !== 'PROJECT_ROOT') { // Skip PROJECT_ROOT as it's handled dynamically
                envVarsNeeded.add(varName);
                if (!envConfig[varName]) {
                  requiredEnvVars[varName] = '';
                }
              }
            }
          }
        });
      }
      
      // Check for environment variables in env object
      if (mcpConfig.env) {
        Object.entries(mcpConfig.env).forEach(([_, value]) => {
          if (typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
            const match = value.match(/{{([^}]+)}}/);
            if (match && match[1]) {
              const varName = match[1];
              envVarsNeeded.add(varName);
              if (!envConfig[varName]) {
                requiredEnvVars[varName] = '';
              }
            }
          }
        });
      }
    }
    
    // 7. Prompt for missing environment variables
    const envQuestions = [];
    
    for (const varName of Object.keys(requiredEnvVars)) {
      envQuestions.push({
        type: 'input',
        name: varName,
        message: `Enter value for ${varName}:`,
        default: envConfig[varName] || ''
      });
    }
    
    let newEnvVars = {};
    if (envQuestions.length > 0) {
      console.log('Some required environment variables are missing. Please provide them:');
      newEnvVars = await inquirer.prompt(envQuestions);
    }
    
    // 8. Update .env file with new values
    const updatedEnvConfig = { ...envConfig, ...newEnvVars };
    
    if (Object.keys(newEnvVars).length > 0) {
      let envFileContent = '';
      
      for (const [key, value] of Object.entries(updatedEnvConfig)) {
        envFileContent += `${key}="${value}"\n`;
      }
      
      await fs.writeFile(envPath, envFileContent);
      console.log('.env file updated with new values.');
    }
    
    // 9. Write the updated template to a custom file
    await fs.writeFile(
      customTemplatePath,
      JSON.stringify(updatedTemplate, null, 2)
    );
    
    // 10. Generate the final config file
    console.log('Generating final configuration file...');
    execSync(`bun run scripts/generate-config.mjs --template ${customTemplatePath}`, { 
      stdio: 'inherit' 
    });
    
    // 11. Clean up the temporary custom template file
    await fs.unlink(customTemplatePath);
    
    console.log('Interactive setup completed successfully.');
  } catch (error) {
    console.error('Error during interactive setup:', error);
    process.exit(1);
  }
}

setupConfig();
