import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

// Command line argument parsing
const cursorWorkspacePath = process.env.CURSOR_WORKSPACE_PATH || ''

// Verify that the specified workspace directory exists and is accessible
try {
  if (cursorWorkspacePath) {
    const stats = await fs.stat(cursorWorkspacePath)
    if (!stats.isDirectory()) {
      console.error(`Error: ${cursorWorkspacePath} is not a directory`)
      process.exit(1)
    }
  }
} catch (error) {
  console.error(
    `Error accessing Cursor workspace directory ${cursorWorkspacePath}:`,
    error,
  )
  process.exit(1)
}

// Schema definitions
const GetProjectInfoArgsSchema = z.object({
  workspace_path: z
    .string()
    .optional()
    .describe('The path to the Cursor workspace (optional)'),
})

const GetActiveFileArgsSchema = z.object({
  workspace_path: z
    .string()
    .optional()
    .describe('The path to the Cursor workspace (optional)'),
})

const IndexWorkspaceArgsSchema = z.object({
  workspace_path: z
    .string()
    .optional()
    .describe('The path to the Cursor workspace (optional)'),
  exclude_patterns: z
    .array(z.string())
    .optional()
    .describe('Patterns to exclude from indexing'),
})

// Server setup
const server = new Server(
  {
    name: 'cursor-integration-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Tool implementations
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_project_info',
        description:
          'Get information about the current Cursor project, including language, frameworks, and dependencies.',
        inputSchema: zodToJsonSchema(GetProjectInfoArgsSchema) as any,
      },
      {
        name: 'get_active_file',
        description:
          'Get the currently active file in the Cursor editor, if available.',
        inputSchema: zodToJsonSchema(GetActiveFileArgsSchema) as any,
      },
      {
        name: 'index_workspace',
        description:
          'Index the Cursor workspace to provide code structure and file relationships.',
        inputSchema: zodToJsonSchema(IndexWorkspaceArgsSchema) as any,
      },
    ],
  }
})

// Helper function to read package.json if it exists
async function readPackageJson(workspacePath: string): Promise<any> {
  try {
    const packageJsonPath = path.join(workspacePath, 'package.json')
    const content = await fs.readFile(packageJsonPath, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    return null
  }
}

// Helper function to detect project type based on files
async function detectProjectType(workspacePath: string): Promise<string[]> {
  const projectTypes: string[] = []
  
  try {
    // Look for common project files
    const files = await fs.readdir(workspacePath)
    
    if (files.includes('package.json')) projectTypes.push('nodejs')
    if (files.includes('go.mod')) projectTypes.push('go')
    if (files.includes('Cargo.toml')) projectTypes.push('rust')
    if (files.includes('requirements.txt') || files.includes('setup.py')) projectTypes.push('python')
    if (files.includes('pom.xml') || files.includes('build.gradle')) projectTypes.push('java')
    if (files.includes('Gemfile')) projectTypes.push('ruby')
    
    // Check for framework-specific files
    if (files.includes('angular.json')) projectTypes.push('angular')
    if (files.includes('next.config.js')) projectTypes.push('nextjs')
    if (files.includes('vite.config.js') || files.includes('vite.config.ts')) projectTypes.push('vite')
    if (files.includes('webpack.config.js')) projectTypes.push('webpack')
    if (files.includes('docker-compose.yml')) projectTypes.push('docker')
    if (files.includes('.env')) projectTypes.push('dotenv')
    
    return projectTypes
  } catch (error) {
    console.error('Error detecting project type:', error)
    return projectTypes
  }
}

// Helper function to find the currently active file (mock implementation)
// In a real implementation, this would integrate with Cursor's API
async function findActiveFile(workspacePath: string): Promise<string | null> {
  // This is a placeholder implementation
  // In a real integration, this would communicate with Cursor to get the active file
  return null
}

// Helper function to index a workspace (basic implementation)
async function indexWorkspace(
  workspacePath: string, 
  excludePatterns: string[] = []
): Promise<any> {
  // Build a simple file index
  const fileIndex: any[] = []

  async function scanDirectory(dirPath: string, rootPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      const relativePath = path.relative(rootPath, fullPath)
      
      // Skip excluded patterns
      if (excludePatterns.some(pattern => {
        if (pattern.startsWith('**/')) {
          // Handle glob patterns like '**/node_modules'
          const patternWithoutGlob = pattern.substring(3)
          return relativePath.includes(patternWithoutGlob)
        }
        return relativePath.includes(pattern)
      })) {
        continue
      }
      
      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('.')) {
          await scanDirectory(fullPath, rootPath)
        }
      } else if (entry.isFile()) {
        fileIndex.push({
          path: relativePath,
          size: (await fs.stat(fullPath)).size,
          type: path.extname(fullPath).substring(1) || 'unknown'
        })
      }
    }
  }
  
  await scanDirectory(workspacePath, workspacePath)
  
  return {
    fileCount: fileIndex.length,
    files: fileIndex
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params
    const workspacePath = args?.workspace_path || cursorWorkspacePath

    if (!workspacePath) {
      throw new Error('No workspace path specified. Please provide a workspace_path argument or set the CURSOR_WORKSPACE_PATH environment variable.')
    }

    switch (name) {
      case 'get_project_info': {
        // Detect project type
        const projectTypes = await detectProjectType(workspacePath)
        
        // Read package.json if available
        const packageJson = await readPackageJson(workspacePath)
        
        // Compile project information
        const projectInfo = {
          path: workspacePath,
          types: projectTypes,
          name: packageJson?.name || path.basename(workspacePath),
          version: packageJson?.version || 'unknown',
          dependencies: packageJson?.dependencies || {},
          devDependencies: packageJson?.devDependencies || {},
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(projectInfo, null, 2),
            },
          ],
        }
      }

      case 'get_active_file': {
        const activeFile = await findActiveFile(workspacePath)
        
        if (!activeFile) {
          return {
            content: [
              {
                type: 'text',
                text: 'No active file found or not available through the MCP integration.',
              },
            ],
          }
        }
        
        try {
          const content = await fs.readFile(activeFile, 'utf8')
          
          return {
            content: [
              {
                type: 'text',
                text: `Active file: ${activeFile}\n\n${content}`,
              },
            ],
          }
        } catch (error) {
          throw new Error(`Failed to read active file: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      case 'index_workspace': {
        const excludePatterns = args?.exclude_patterns || ['node_modules', '.git', 'dist', 'build']
        
        const indexResult = await indexWorkspace(workspacePath, excludePatterns)
        
        return {
          content: [
            {
              type: 'text',
              text: `Workspace indexed. Found ${indexResult.fileCount} files.\nFirst 10 files: ${JSON.stringify(indexResult.files.slice(0, 10), null, 2)}`,
            },
          ],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    }
  }
})

// Start server
async function runServer() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Cursor Integration MCP Server running on stdio')
  console.error('Cursor workspace path:', cursorWorkspacePath || '(not specified)')
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error)
  process.exit(1)
})
