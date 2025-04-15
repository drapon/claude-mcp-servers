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

// Schema definitions
const ListShadcnComponentsArgsSchema = z.object({
  projectPath: z.string().optional().describe('Path to the project directory containing shadcn/ui configuration'),
});

const GetShadcnComponentInfoArgsSchema = z.object({
  name: z.string().describe('Component name to get details for'),
  projectPath: z.string().optional().describe('Path to the project directory containing shadcn/ui configuration'),
  depth: z.number().optional().default(3).describe('Depth level for type expansion'),
});

const GetShadcnDesignTokensArgsSchema = z.object({
  category: z.enum(['colors', 'space', 'typography', 'radii', 'shadows', 'all']).describe('Category of design tokens to fetch'),
  projectPath: z.string().optional().describe('Path to the project directory containing shadcn/ui configuration'),
});

// Server setup
const server = new Server(
  {
    name: 'shadcn-ui-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Caches for component information and design tokens
const componentInfoCache = new Map();
const designTokenCache = new Map();
const configCache = new Map();

// Helper function to find shadcn config in a project
async function findShadcnConfig(projectPathParam?: string): Promise<{ configPath: string; projectPath: string } | null> {
  // 1. If projectPath is explicitly provided, check there first
  if (projectPathParam) {
    const configPath = path.join(projectPathParam, 'components.json');
    try {
      await fs.access(configPath);
      return { configPath, projectPath: projectPathParam };
    } catch (error) {
      console.error(`No components.json found at ${configPath}`);
    }
  }

  // 2. Check if config is specified via environment variable
  if (process.env.SHADCN_CONFIG_PATH) {
    try {
      await fs.access(process.env.SHADCN_CONFIG_PATH);
      const projectPath = path.dirname(process.env.SHADCN_CONFIG_PATH);
      return { configPath: process.env.SHADCN_CONFIG_PATH, projectPath };
    } catch (error) {
      console.error(`Cannot access config at ${process.env.SHADCN_CONFIG_PATH}`);
    }
  }

  // 3. Try to find config in current working directory or parent directories
  let currentDir = process.cwd();
  const rootDir = path.parse(currentDir).root;

  while (currentDir !== rootDir) {
    const configPath = path.join(currentDir, 'components.json');
    try {
      await fs.access(configPath);
      return { configPath, projectPath: currentDir };
    } catch (error) {
      // Config not found in this directory, try parent
      currentDir = path.dirname(currentDir);
    }
  }

  // 4. If no config found, return null
  return null;
}

// Helper to load component information
async function getComponentInfo(name: string, projectPath?: string, depth: number = 3) {
  // In a real implementation, you'd analyze the component's TypeScript definition
  // Here we provide sample data for demonstration purposes
  
  // Create cache key
  const cacheKey = `${projectPath || 'default'}_${name}`;
  
  // Check cache first
  if (componentInfoCache.has(cacheKey)) {
    return componentInfoCache.get(cacheKey);
  }
  
  // Component data (this would normally be extracted from TypeScript files)
  const componentData = {
    name,
    description: `A ${name} component from shadcn/ui library`,
    props: await getComponentProps(name),
    variants: await getComponentVariants(name),
    relatedComponents: await getRelatedComponents(name),
  };
  
  // Cache the result
  componentInfoCache.set(cacheKey, componentData);
  
  return componentData;
}

// Helper to get component props (simplified for now)
async function getComponentProps(name: string) {
  // This would normally use ts-morph to extract real prop types
  const commonProps = {
    className: {
      type: "string",
      description: "Additional CSS class names",
      required: false
    },
    children: {
      type: "React.ReactNode",
      description: "Component children",
      required: false
    },
  };
  
  // Component-specific props based on name
  const specificProps: Record<string, any> = {
    Button: {
      variant: {
        type: "enum",
        values: ["default", "destructive", "outline", "secondary", "ghost", "link"],
        description: "Button style variant",
        required: false,
        default: "default"
      },
      size: {
        type: "enum",
        values: ["default", "sm", "lg", "icon"],
        description: "Button size",
        required: false,
        default: "default"
      },
      asChild: {
        type: "boolean",
        description: "Whether to render as a child element",
        required: false,
        default: false
      },
      disabled: {
        type: "boolean",
        description: "Whether the button is disabled",
        required: false
      }
    },
    Accordion: {
      type: {
        type: "enum",
        values: ["single", "multiple"],
        description: "Accordion behavior type",
        required: true
      },
      collapsible: {
        type: "boolean",
        description: "Whether the accordion items can be collapsed",
        required: false
      },
      value: {
        type: "string | string[]",
        description: "Controlled value for accordion",
        required: false
      },
      defaultValue: {
        type: "string | string[]",
        description: "Default value for uncontrolled accordion",
        required: false
      }
    },
    // Add more components as needed
  };
  
  return {
    ...commonProps,
    ...(specificProps[name] || {})
  };
}

// Helper to get component variants
async function getComponentVariants(name: string) {
  // This would normally extract variants from the component's source code
  const variants: Record<string, any> = {
    Button: {
      variant: ["default", "destructive", "outline", "secondary", "ghost", "link"],
      size: ["default", "sm", "lg", "icon"]
    },
    Accordion: {
      type: ["single", "multiple"]
    },
    // Add more components as needed
  };
  
  return variants[name] || {};
}

// Helper to get related components
async function getRelatedComponents(name: string) {
  // Map of component families
  const componentFamilies: Record<string, string[]> = {
    Accordion: ["Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent"],
    AlertDialog: ["AlertDialog", "AlertDialogTrigger", "AlertDialogContent", "AlertDialogHeader", 
                 "AlertDialogFooter", "AlertDialogTitle", "AlertDialogDescription", "AlertDialogAction", 
                 "AlertDialogCancel"],
    // Add more component families as needed
  };
  
  // Find which family this component belongs to
  for (const [family, components] of Object.entries(componentFamilies)) {
    if (components.includes(name)) {
      return components.filter(c => c !== name);
    }
  }
  
  return [];
}

// Helper function to extract design tokens from tailwind config
async function getDesignTokens(category: string, projectPath?: string) {
  // Create cache key
  const cacheKey = `${projectPath || 'default'}_${category}`;
  
  // Check cache first
  if (designTokenCache.has(cacheKey)) {
    return designTokenCache.get(cacheKey);
  }
  
  // In a real implementation, you would parse the tailwind.config.js file
  // For now, we'll return sample data based on the standard shadcn/ui theme
  
  const allTokens = {
    colors: {
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      secondary: {
        DEFAULT: "hsl(var(--secondary))",
        foreground: "hsl(var(--secondary-foreground))",
      },
      destructive: {
        DEFAULT: "hsl(var(--destructive))",
        foreground: "hsl(var(--destructive-foreground))",
      },
      muted: {
        DEFAULT: "hsl(var(--muted))",
        foreground: "hsl(var(--muted-foreground))",
      },
      accent: {
        DEFAULT: "hsl(var(--accent))",
        foreground: "hsl(var(--accent-foreground))",
      },
      popover: {
        DEFAULT: "hsl(var(--popover))",
        foreground: "hsl(var(--popover-foreground))",
      },
      card: {
        DEFAULT: "hsl(var(--card))",
        foreground: "hsl(var(--card-foreground))",
      },
    },
    space: {
      0: "0px",
      1: "0.25rem",
      2: "0.5rem",
      3: "0.75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      8: "2rem",
      10: "2.5rem",
      12: "3rem",
      16: "4rem",
      20: "5rem",
      24: "6rem",
    },
    typography: {
      fontSizes: {
        xs: "0.75rem",
        sm: "0.875rem",
        base: "1rem",
        lg: "1.125rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
        "4xl": "2.25rem",
        "5xl": "3rem",
      },
      fontWeights: {
        thin: "100",
        extralight: "200",
        light: "300",
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
        black: "900",
      },
      lineHeights: {
        none: "1",
        tight: "1.25",
        snug: "1.375",
        normal: "1.5",
        relaxed: "1.625",
        loose: "2",
      },
    },
    radii: {
      lg: "var(--radius)",
      md: "calc(var(--radius) - 2px)",
      sm: "calc(var(--radius) - 4px)",
    },
    shadows: {
      sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
      "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
      inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
    },
  };
  
  // Return requested category or all
  let result: Record<string, any>;
  if (category === 'all') {
    result = allTokens;
  } else {
    result = { [category]: allTokens[category as keyof typeof allTokens] };
  }
  
  // Cache the result
  designTokenCache.set(cacheKey, result);
  
  return result;
}

// Helper function to get available component names
async function getComponentNames() {
  // In a real implementation, this would scan the shadcn/ui components directory
  // For now, returning a sample list of common components
  return [
    'Accordion',
    'AccordionItem',
    'AccordionTrigger',
    'AccordionContent',
    'Alert',
    'AlertDialog',
    'AlertDialogAction',
    'AlertDialogCancel',
    'AlertDialogContent',
    'AlertDialogDescription',
    'AlertDialogFooter',
    'AlertDialogHeader',
    'AlertDialogTitle',
    'AlertDialogTrigger',
    'AspectRatio',
    'Avatar',
    'AvatarFallback',
    'AvatarImage',
    'Badge',
    'Button',
    'Calendar',
    'Card',
    'CardContent',
    'CardDescription',
    'CardFooter',
    'CardHeader',
    'CardTitle',
    'Checkbox',
    'Collapsible',
    'CollapsibleContent',
    'CollapsibleTrigger',
    'Command',
    'CommandDialog',
    'CommandEmpty',
    'CommandGroup',
    'CommandInput',
    'CommandItem',
    'CommandList',
    'CommandSeparator',
    'CommandShortcut',
    'ContextMenu',
    'ContextMenuCheckboxItem',
    'ContextMenuContent',
    'ContextMenuGroup',
    'ContextMenuItem',
    'ContextMenuLabel',
    'ContextMenuPortal',
    'ContextMenuRadioGroup',
    'ContextMenuRadioItem',
    'ContextMenuSeparator',
    'ContextMenuShortcut',
    'ContextMenuSub',
    'ContextMenuSubContent',
    'ContextMenuSubTrigger',
    'ContextMenuTrigger',
    'Dialog',
    'DialogContent',
    'DialogDescription',
    'DialogFooter',
    'DialogHeader',
    'DialogTitle',
    'DialogTrigger',
    'DropdownMenu',
    'DropdownMenuCheckboxItem',
    'DropdownMenuContent',
    'DropdownMenuGroup',
    'DropdownMenuItem',
    'DropdownMenuLabel',
    'DropdownMenuPortal',
    'DropdownMenuRadioGroup',
    'DropdownMenuRadioItem',
    'DropdownMenuSeparator',
    'DropdownMenuShortcut',
    'DropdownMenuSub',
    'DropdownMenuSubContent',
    'DropdownMenuSubTrigger',
    'DropdownMenuTrigger',
    'Form',
    'FormControl',
    'FormDescription',
    'FormField',
    'FormItem',
    'FormLabel',
    'FormMessage',
    'HoverCard',
    'HoverCardContent',
    'HoverCardTrigger',
    'Input',
    'Label',
    'Menubar',
    'MenubarCheckboxItem',
    'MenubarContent',
    'MenubarGroup',
    'MenubarItem',
    'MenubarLabel',
    'MenubarMenu',
    'MenubarPortal',
    'MenubarRadioGroup',
    'MenubarRadioItem',
    'MenubarSeparator',
    'MenubarShortcut',
    'MenubarSub',
    'MenubarSubContent',
    'MenubarSubTrigger',
    'MenubarTrigger',
    'NavigationMenu',
    'NavigationMenuContent',
    'NavigationMenuIndicator',
    'NavigationMenuItem',
    'NavigationMenuLink',
    'NavigationMenuList',
    'NavigationMenuTrigger',
    'NavigationMenuViewport',
    'Popover',
    'PopoverContent',
    'PopoverTrigger',
    'Progress',
    'RadioGroup',
    'RadioGroupItem',
    'ScrollArea',
    'ScrollBar',
    'Select',
    'SelectContent',
    'SelectGroup',
    'SelectItem',
    'SelectLabel',
    'SelectSeparator',
    'SelectTrigger',
    'SelectValue',
    'Separator',
    'Sheet',
    'SheetClose',
    'SheetContent',
    'SheetDescription',
    'SheetFooter',
    'SheetHeader',
    'SheetTitle',
    'SheetTrigger',
    'Skeleton',
    'Slider',
    'Switch',
    'Table',
    'TableBody',
    'TableCaption',
    'TableCell',
    'TableFooter',
    'TableHead',
    'TableHeader',
    'TableRow',
    'Tabs',
    'TabsContent',
    'TabsList',
    'TabsTrigger',
    'Textarea',
    'Toast',
    'ToastAction',
    'ToastClose',
    'ToastDescription',
    'ToastProvider',
    'ToastTitle',
    'ToastViewport',
    'Toggle',
    'ToggleGroup',
    'ToggleGroupItem',
    'Tooltip',
    'TooltipContent',
    'TooltipProvider',
    'TooltipTrigger',
  ];
}

// Tool implementations
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_shadcn_components',
        description: 'Lists all available shadcn/ui components.',
        inputSchema: zodToJsonSchema(ListShadcnComponentsArgsSchema) as any,
      },
      {
        name: 'get_shadcn_component_info',
        description: 'Get detailed information about a specific shadcn/ui component including props and variants.',
        inputSchema: zodToJsonSchema(GetShadcnComponentInfoArgsSchema) as any,
      },
      {
        name: 'get_shadcn_design_tokens',
        description: 'Get design tokens used in shadcn/ui components such as colors, typography, spacing, etc.',
        inputSchema: zodToJsonSchema(GetShadcnDesignTokensArgsSchema) as any,
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params

    switch (name) {
      case 'list_shadcn_components': {
        const parsed = ListShadcnComponentsArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for list_shadcn_components: ${parsed.error}`)
        }

        const components = await getComponentNames();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: components.length,
                components: components
              }),
            },
          ],
        }
      }

      case 'get_shadcn_component_info': {
        const parsed = GetShadcnComponentInfoArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_shadcn_component_info: ${parsed.error}`)
        }

        const componentName = parsed.data.name;
        const projectPath = parsed.data.projectPath;
        const depth = parsed.data.depth;
        
        const componentInfo = await getComponentInfo(componentName, projectPath, depth);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(componentInfo),
            },
          ],
        }
      }

      case 'get_shadcn_design_tokens': {
        const parsed = GetShadcnDesignTokensArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_shadcn_design_tokens: ${parsed.error}`)
        }

        const category = parsed.data.category;
        const projectPath = parsed.data.projectPath;
        
        const tokens = await getDesignTokens(category, projectPath);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tokens),
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
  console.error('shadcn/ui MCP Server running on stdio')
  
  // Log environment information
  console.error('Environment:')
  console.error(`- Current working directory: ${process.cwd()}`)
  console.error(`- SHADCN_CONFIG_PATH: ${process.env.SHADCN_CONFIG_PATH || 'not set'}`)
  
  // Try to find shadcn config
  const configInfo = await findShadcnConfig();
  if (configInfo) {
    console.error(`- Found shadcn/ui config at: ${configInfo.configPath}`)
    console.error(`- Project path: ${configInfo.projectPath}`)
  } else {
    console.error('- No shadcn/ui config found in current directory or parents')
  }
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error)
  process.exit(1)
})
