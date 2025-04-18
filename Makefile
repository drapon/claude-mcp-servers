# Define file paths
TEMPLATE_FILE := claude_desktop_config.template.json
CONFIG_FILE := claude_desktop_config.json
CURSOR_TEMPLATE_FILE := cursor_config.template.json
CURSOR_CONFIG_FILE := config.json
ENV_FILE := .env
# Ensure the destination path handles spaces correctly if quoted later
CLAUDE_DEST_DIR := "$(HOME)/Library/Application Support/Claude"
CURSOR_DEST_DIR := "$(HOME)/.cursor/mcp"

# Default target
all: setup

# Target to install dependencies
install:
	@echo "Installing dependencies in root directory..."
	@bun install
	@echo "Installing dependencies in ts directory..."
	@cd ts && bun install
	@echo "All dependencies installed."

# Interactive setup target with MCP selection for Claude
select-mcps: install
	@echo "Running interactive MCP selection..."
	@bun run scripts/setup-config.mjs
	@echo "Copying $(CONFIG_FILE) to $(CLAUDE_DEST_DIR)..."
	@mkdir -p $(CLAUDE_DEST_DIR) # Ensure destination directory exists
	@cp $(CONFIG_FILE) $(CLAUDE_DEST_DIR)/
	@echo "Setup complete. You may need to restart the Claude Desktop app."

# Standard setup target for Claude
setup: install $(CONFIG_FILE)
	@echo "Copying $(CONFIG_FILE) to $(CLAUDE_DEST_DIR)..."
	@mkdir -p $(CLAUDE_DEST_DIR) # Ensure destination directory exists
	@cp $(CONFIG_FILE) $(CLAUDE_DEST_DIR)/
	@echo "Setup complete. You may need to restart the Claude Desktop app."

# Target to generate the config file from the template and .env using Node.js script
# This target runs if $(CONFIG_FILE) doesn't exist or if $(TEMPLATE_FILE) or $(ENV_FILE) is newer
$(CONFIG_FILE): $(TEMPLATE_FILE) $(ENV_FILE) scripts/generate-config.mjs package.json bun.lock
	@bun run scripts/generate-config.mjs

# Setup target for Cursor
cursor-setup: install cursor-config
	@echo "Copying $(CURSOR_CONFIG_FILE) to $(CURSOR_DEST_DIR)..."
	@mkdir -p $(CURSOR_DEST_DIR) # Ensure destination directory exists
	@cp $(CURSOR_CONFIG_FILE) $(CURSOR_DEST_DIR)/
	@echo "Setup complete. You may need to restart the Cursor IDE."

# Interactive setup target for Cursor
cursor-interactive: install
	@echo "Running Cursor MCP setup script..."
	@chmod +x scripts/setup_cursor_mcp.sh
	@./scripts/setup_cursor_mcp.sh
	@echo "Cursor MCP setup complete."

# Target to generate Cursor config
cursor-config: $(CURSOR_TEMPLATE_FILE) $(ENV_FILE)
	@echo "Generating Cursor config file..."
	@bun run scripts/generate-cursor-config.mjs
	@echo "Cursor config file generated."

# Clean target (optional)
clean:
	@echo "Removing generated config files..."
	@rm -f $(CONFIG_FILE)
	@rm -f $(CURSOR_CONFIG_FILE)

# Phony targets prevent conflicts with files of the same name
.PHONY: all setup select-mcps install clean cursor-setup cursor-interactive cursor-config
