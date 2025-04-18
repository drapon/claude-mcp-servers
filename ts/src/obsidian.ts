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
const obsidianVaultDirArg = process.env.OBSIDIAN_VAULT_DIR || process.argv.slice(2)[0]
if (!obsidianVaultDirArg) {
  console.error('Error: No Obsidian vault directory specified. Set OBSIDIAN_VAULT_DIR environment variable or provide as command line argument.')
  process.exit(1)
}

// Store the Obsidian vault directory
const obsidianVaultDir = path.resolve(obsidianVaultDirArg)

// Verify that the specified directory exists and is accessible
try {
  const stats = await fs.stat(obsidianVaultDir)
  if (!stats.isDirectory()) {
    console.error(`Error: ${obsidianVaultDir} is not a directory`)
    process.exit(1)
  }
} catch (error) {
  console.error(
    `Error accessing Obsidian vault directory ${obsidianVaultDir}:`,
    error,
  )
  process.exit(1)
}

// Utility function to ensure a path is within the Obsidian vault
async function validatePath(notePath: string): Promise<string> {
  // Normalize paths to handle various inputs
  const fullPath = path.isAbsolute(notePath)
    ? path.normalize(notePath)
    : path.join(obsidianVaultDir, notePath)

  // Check if path is within the vault directory
  if (!fullPath.startsWith(obsidianVaultDir)) {
    throw new Error(`Access denied - path outside Obsidian vault: ${fullPath}`)
  }

  // Ensure the path has .md extension for notes
  const ext = path.extname(fullPath)
  const validPath = ext === '.md' ? fullPath : `${fullPath}.md`

  return validPath
}

// Schema definitions
const WriteNoteArgsSchema = z.object({
  path: z
    .string()
    .describe(
      'The path to the note within the Obsidian vault (with or without .md extension)',
    ),
  content: z.string().describe('The content to write to the note'),
  append: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, append to the note instead of overwriting'),
})

const DeleteNoteArgsSchema = z.object({
  path: z
    .string()
    .describe(
      'The path to the note within the Obsidian vault (with or without .md extension)',
    ),
})

const ReadNotesArgsSchema = z.object({
  paths: z
    .array(z.string())
    .describe('List of note paths to read (with or without .md extension)'),
})

const SearchNotesArgsSchema = z.object({
  query: z
    .string()
    .describe('Query to search for in note names (case-insensitive)'),
})

// Server setup
const server = new Server(
  {
    name: 'obsidian-server',
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
        name: 'write_note',
        description:
          'Create a new note or update an existing note in the Obsidian vault. Can either completely replace the note content or append to it.',
        inputSchema: zodToJsonSchema(WriteNoteArgsSchema) as any,
      },
      {
        name: 'delete_note',
        description: 'Delete a note from the Obsidian vault.',
        inputSchema: zodToJsonSchema(DeleteNoteArgsSchema) as any,
      },
      {
        name: 'read_notes',
        description:
          "Read the contents of multiple notes. Each note's content is returned with its path as a reference. Failed reads for individual notes won't stop the entire operation. Reading too many at once may result in an error.",
        inputSchema: zodToJsonSchema(ReadNotesArgsSchema) as any,
      },
      {
        name: 'search_notes',
        description:
          'Searches for a note by its name. The search is case-insensitive and matches partial names. Queries can also be a valid regex. Returns paths of the notes that match the query.',
        inputSchema: zodToJsonSchema(SearchNotesArgsSchema) as any,
      },
    ],
  }
})

async function findNotes(searchTerm: string): Promise<string[]> {
  // Helper function to recursively search for notes in a directory
  async function searchDirectory(
    dirPath: string,
    results: string[] = [],
  ): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        // Skip hidden directories (starting with .)
        if (!entry.name.startsWith('.')) {
          await searchDirectory(fullPath, results)
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Check if the file name matches the search term
        let nameWithoutExt = entry.name.slice(0, -3) // Remove .md extension

        try {
          // Try to treat the search term as a regex if it appears to be one
          let isRegex = false
          if (
            searchTerm.startsWith('/') &&
            (searchTerm.endsWith('/') ||
              searchTerm.endsWith('/i') ||
              searchTerm.endsWith('/g') ||
              searchTerm.endsWith('/gi') ||
              searchTerm.endsWith('/ig'))
          ) {
            isRegex = true
          }

          if (isRegex) {
            // Extract pattern and flags from /pattern/flags
            const match = searchTerm.match(/^\/(.*)\/([gimuy]*)$/)
            if (match) {
              const [, pattern, flags] = match
              const regex = new RegExp(pattern, flags)
              if (regex.test(nameWithoutExt) || regex.test(entry.name)) {
                results.push(fullPath)
              }
            }
          } else if (
            nameWithoutExt.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.name.toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            results.push(fullPath)
          }
        } catch (e) {
          // If regex fails, fall back to simple includes
          if (
            nameWithoutExt.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.name.toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            results.push(fullPath)
          }
        }
      }
    }

    return results
  }

  return searchDirectory(obsidianVaultDir)
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params

    switch (name) {
      case 'write_note': {
        const parsed = WriteNoteArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for write_note: ${parsed.error}`)
        }

        const validPath = await validatePath(parsed.data.path)

        // Create parent directories if they don't exist
        const parentDir = path.dirname(validPath)
        await fs.mkdir(parentDir, { recursive: true })

        // Check if we're appending or overwriting
        if (parsed.data.append) {
          try {
            // Check if the file exists first
            const existingContent = await fs.readFile(validPath, 'utf-8')
            await fs.writeFile(
              validPath,
              existingContent + '\\n\\n' + parsed.data.content,
              'utf-8',
            )
          } catch (error) {
            // If file doesn't exist, just create it
            await fs.writeFile(validPath, parsed.data.content, 'utf-8')
          }
        } else {
          // Overwrite or create new file
          await fs.writeFile(validPath, parsed.data.content, 'utf-8')
        }

        // Return the relative path for reference
        const relativePath = path.relative(obsidianVaultDir, validPath)
        return {
          content: [
            {
              type: 'text',
              text: `Successfully ${
                parsed.data.append ? 'appended to' : 'wrote'
              } note: ${relativePath}`,
            },
          ],
        }
      }

      case 'delete_note': {
        const parsed = DeleteNoteArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for delete_note: ${parsed.error}`)
        }

        const validPath = await validatePath(parsed.data.path)

        try {
          await fs.unlink(validPath)

          // Return the relative path for reference
          const relativePath = path.relative(obsidianVaultDir, validPath)
          return {
            content: [
              {
                type: 'text',
                text: `Successfully deleted note: ${relativePath}`,
              },
            ],
          }
        } catch (error) {
          throw new Error(
            `Failed to delete note: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      }

      case 'read_notes': {
        const parsed = ReadNotesArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for read_notes: ${parsed.error}`)
        }

        const results = await Promise.all(
          parsed.data.paths.map(async (notePath: string) => {
            try {
              const validPath = await validatePath(notePath)
              const content = await fs.readFile(validPath, 'utf-8')
              // Return the relative path for reference
              const relativePath = path.relative(obsidianVaultDir, validPath)
              return `# ${relativePath}\\n\\n${content}\\n`
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error)
              return `Error reading note ${notePath}: ${errorMessage}`
            }
          }),
        )

        return {
          content: [{ type: 'text', text: results.join('\\n---\\n') }],
        }
      }

      case 'search_notes': {
        const parsed = SearchNotesArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for search_notes: ${parsed.error}`)
        }

        const results = await findNotes(parsed.data.query)

        // Convert absolute paths to relative paths for better readability
        const relativePaths = results.map((p) =>
          path.relative(obsidianVaultDir, p),
        )

        return {
          content: [
            {
              type: 'text',
              text:
                relativePaths.length > 0
                  ? `Found ${
                      relativePaths.length
                    } notes:\\n${relativePaths.join('\\n')}`
                  : `No notes found matching "${parsed.data.query}"`,
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
  console.error('Obsidian MCP Server running on stdio')
  console.error('Obsidian vault directory:', obsidianVaultDir)
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error)
  process.exit(1)
})
