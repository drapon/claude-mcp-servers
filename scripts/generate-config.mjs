import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import minimist from "minimist";

const args = minimist(process.argv.slice(2));
const projectRoot = process.cwd();
// Allow custom template path if specified via --template flag
const templatePath = args.template 
  ? args.template 
  : path.join(projectRoot, "claude_desktop_config.template.json");
const configPath = path.join(projectRoot, "claude_desktop_config.json");
const envPath = path.join(projectRoot, ".env");

async function generateConfig() {
  try {
    console.log(
      `Generating ${configPath} from ${templatePath} and ${envPath}...`
    );

    // Read .env file
    const envConfig = dotenv.parse(await fs.readFile(envPath));

    // Read template file
    let templateContent = await fs.readFile(templatePath, "utf-8");

    // Replace {{PROJECT_ROOT}}
    templateContent = templateContent.replace(/{{PROJECT_ROOT}}/g, projectRoot);

    // Replace other placeholders from .env
    for (const key in envConfig) {
      if (Object.hasOwnProperty.call(envConfig, key)) {
        const value = envConfig[key];
        // Escape backslashes and double quotes for JSON string compatibility
        const escapedValue = value.replace(/\\\\/g, "\\\\\\\\").replace(/\"/g, '\\\\"');
        const placeholder = `{{${key}}}`;
        // Use a regex with global flag to replace all occurrences
        templateContent = templateContent.replace(
          new RegExp(
            placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),
            "g"
          ),
          escapedValue
        );
      }
    }

    // Write the final config file
    await fs.writeFile(configPath, templateContent);

    console.log(`${configPath} generated successfully.`);
  } catch (error) {
    console.error("Error generating config file:", error);
    process.exit(1);
  }
}

generateConfig();
