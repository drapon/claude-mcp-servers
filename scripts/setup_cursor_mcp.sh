#!/bin/bash

# Setup script for Cursor MCP configuration
# This script sets up the MCP configuration for Cursor IDE

# Exit on error
set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
CONFIG_DIR="$HOME/.cursor/mcp"
TEMPLATE_FILE="$PROJECT_ROOT/cursor_config.template.json"
OUTPUT_FILE="$CONFIG_DIR/config.json"

# Display banner
echo "========================================"
echo "   Cursor MCP Configuration Setup      "
echo "========================================"
echo

# Check if .env file exists
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "Error: .env file not found. Please create one based on .env.sample"
  exit 1
fi

# Source environment variables
source "$PROJECT_ROOT/.env"

# Check required environment variables
required_vars=("BUN_PATH" "HOME_DIR" "OBSIDIAN_VAULT_DIR")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: $var is not set in .env file"
    exit 1
  fi
done

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

echo "Creating Cursor MCP configuration..."

# Ask for Cursor workspace path
read -p "Enter your default Cursor workspace path (or leave empty): " CURSOR_WORKSPACE_PATH

# Generate config from template
sed -e "s|{{BUN_PATH}}|$BUN_PATH|g" \
    -e "s|{{HOME_DIR}}|$HOME_DIR|g" \
    -e "s|{{PROJECT_ROOT}}|$PROJECT_ROOT|g" \
    -e "s|{{OBSIDIAN_VAULT_DIR}}|$OBSIDIAN_VAULT_DIR|g" \
    -e "s|{{BRAVE_API_KEY}}|$BRAVE_API_KEY|g" \
    -e "s|{{GITHUB_TOKEN}}|$GITHUB_TOKEN|g" \
    -e "s|{{SUPABASE_API_KEY}}|$SUPABASE_API_KEY|g" \
    -e "s|{{UVX_PATH}}|$UVX_PATH|g" \
    -e "s|{{NPX_PATH}}|$NPX_PATH|g" \
    -e "s|{{CLAUDE_CLI_PATH}}|$CLAUDE_CLI_PATH|g" \
    -e "s|{{FIGMA_API_KEY}}|$FIGMA_API_KEY|g" \
    -e "s|{{CUSTOM_USER_AGENT}}|$CUSTOM_USER_AGENT|g" \
    -e "s|{{IGNORE_ROBOTS_TXT}}|$IGNORE_ROBOTS_TXT|g" \
    -e "s|{{CURSOR_WORKSPACE_PATH}}|$CURSOR_WORKSPACE_PATH|g" \
    "$TEMPLATE_FILE" > "$OUTPUT_FILE"

echo
echo "Configuration generated at: $OUTPUT_FILE"
echo
echo "Next steps:"
echo "1. Open Cursor IDE"
echo "2. Go to Settings > Extensions > MCP"
echo "3. Add the config path: $OUTPUT_FILE"
echo "4. Restart Cursor IDE"
echo
echo "Setup complete!"
