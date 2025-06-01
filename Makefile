# Define file paths
TEMPLATE_FILE := claude_desktop_config.template.json
CONFIG_FILE := claude_desktop_config.json
CURSOR_TEMPLATE_FILE := cursor_config.template.json
CURSOR_CONFIG_FILE := config.json
ENV_FILE := .env
# Ensure the destination path handles spaces correctly if quoted later
CLAUDE_DEST_DIR := "$(HOME)/Library/Application Support/Claude"
CURSOR_DEST_DIR := "$(HOME)/.cursor/mcp"
# Claude Code MCP paths
DIST_DIR := dist
BASE_PATH := $(PWD)

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
	@rm -rf $(DIST_DIR)

# ==============================================================================
# Claude Code MCP Management
# ==============================================================================

# Build individual MCPs for Claude Code
build-individual-mcps: install
	@echo "🔨 Building individual MCPs for Claude Code..."
	@mkdir -p $(DIST_DIR)
	@echo "📁 Created $(DIST_DIR) directory"
	@echo "📦 Copying MCP servers to $(DIST_DIR)..."
	@for file in ts/src/*.ts; do \
		if [ -f "$$file" ]; then \
			name=$$(basename "$$file" .ts); \
			mkdir -p "$(DIST_DIR)/$$name"; \
			cp "$$file" "$(DIST_DIR)/$$name/index.ts"; \
			echo "✅ Copied $$name"; \
		fi; \
	done
	@echo "🎉 Individual MCPs prepared successfully!"

# Interactive setup for Claude Code MCPs
setup-claude-code: build-individual-mcps
	@echo "🚀 Setting up Claude Code MCPs..."
	@bun run scripts/setup-claude-code.mjs

# Reset and setup Claude Code MCPs (recommended)
reset-and-setup-claude-code: build-individual-mcps
	@echo "🔄 Resetting existing Claude Code MCP configurations..."
	@bun run scripts/reset-claude-code.mjs
	@echo "🚀 Setting up new configurations..."
	@bun run scripts/setup-claude-code.mjs

# Reset Claude Code MCP configurations only
reset-claude-code:
	@echo "🔄 Resetting Claude Code MCP configurations..."
	@bun run scripts/reset-claude-code.mjs

# List current Claude Code MCP servers
list-claude-code-mcps:
	@echo "📋 Current Claude Code MCP servers:"
	@claude mcp list 2>/dev/null || echo "❌ No Claude Code MCPs configured or Claude Code not available"

# Generate Claude Code MCP commands for copy-paste
generate-claude-commands: build-individual-mcps
	@echo "📋 Generating Claude Code MCP commands (local scope)..."
	@bun run scripts/generate-claude-code-commands.mjs local bash

# Generate Claude Code MCP commands for project scope
generate-claude-commands-project: build-individual-mcps
	@echo "📋 Generating Claude Code MCP commands (project scope)..."
	@bun run scripts/generate-claude-code-commands.mjs project bash

# Generate Claude Code MCP commands for user scope
generate-claude-commands-user: build-individual-mcps
	@echo "📋 Generating Claude Code MCP commands (user scope)..."
	@bun run scripts/generate-claude-code-commands.mjs user bash

# Generate Claude Code MCP commands in markdown format
generate-claude-commands-md: build-individual-mcps
	@echo "📋 Generating Claude Code MCP commands (markdown)..."
	@bun run scripts/generate-claude-code-commands.mjs local markdown

# Generate Claude Code MCP commands in JSON format
generate-claude-commands-json: build-individual-mcps
	@echo "📋 Generating Claude Code MCP commands (JSON)..."
	@bun run scripts/generate-claude-code-commands.mjs local json

# Save commands to file for easy copy-paste
save-claude-commands: build-individual-mcps
	@echo "💾 Saving Claude Code MCP commands to file..."
	@bun run scripts/generate-claude-code-commands.mjs local bash > claude-mcp-setup.sh
	@chmod +x claude-mcp-setup.sh
	@echo "✅ Commands saved to claude-mcp-setup.sh"
	@echo "💡 Run: ./claude-mcp-setup.sh"

# Phony targets prevent conflicts with files of the same name
.PHONY: all setup select-mcps install clean cursor-setup cursor-interactive cursor-config \
        build-individual-mcps setup-claude-code reset-and-setup-claude-code reset-claude-code list-claude-code-mcps \
        generate-claude-commands generate-claude-commands-project generate-claude-commands-user \
        generate-claude-commands-md generate-claude-commands-json save-claude-commands
