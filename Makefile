# Define file paths
TEMPLATE_FILE := claude_desktop_config.template.json
CONFIG_FILE := claude_desktop_config.json
ENV_FILE := .env
# Ensure the destination path handles spaces correctly if quoted later
DEST_DIR := "$(HOME)/Library/Application Support/Claude"

# Default target
all: setup

# Target to install dependencies
install:
	@echo "Installing dependencies in root directory..."
	@bun install
	@echo "Installing dependencies in ts directory..."
	@cd ts && bun install
	@echo "All dependencies installed."

# Interactive setup target
setup-interactive: install
	@echo "Running interactive setup..."
	@bun run scripts/setup-config.mjs
	@echo "Copying $(CONFIG_FILE) to $(DEST_DIR)..."
	@mkdir -p $(DEST_DIR) # Ensure destination directory exists
	@cp $(CONFIG_FILE) $(DEST_DIR)/
	@echo "Setup complete. You may need to restart the Claude Desktop app."

# Standard setup target
setup: install $(CONFIG_FILE)
	@echo "Copying $(CONFIG_FILE) to $(DEST_DIR)..."
	@mkdir -p $(DEST_DIR) # Ensure destination directory exists
	@cp $(CONFIG_FILE) $(DEST_DIR)/
	@echo "Setup complete. You may need to restart the Claude Desktop app."

# Target to generate the config file from the template and .env using Node.js script
# This target runs if $(CONFIG_FILE) doesn't exist or if $(TEMPLATE_FILE) or $(ENV_FILE) is newer
$(CONFIG_FILE): $(TEMPLATE_FILE) $(ENV_FILE) scripts/generate-config.mjs package.json bun.lock
	@bun run scripts/generate-config.mjs

# Clean target (optional)
clean:
	@echo "Removing generated config file $(CONFIG_FILE)..."
	@rm -f $(CONFIG_FILE)

# Phony targets prevent conflicts with files of the same name
.PHONY: all setup setup-interactive install clean
