#!/usr/bin/env node
import { config } from 'dotenv';
import { join } from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { VaultClient } from './clients/vault-client.js';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

interface SearchNotesArgs {
  query: string;
  includeTags?: boolean;
  includePath?: boolean;
  excludeFolders?: string[];
  limit?: number;
}

interface GetNoteArgs {
  path: string;
}

interface GetTagsArgs {
  minCount?: number;
}

export class ObsidianServer {
  private server: Server;
  private vaultClient: VaultClient;
  private transport?: StdioServerTransport;

  constructor(vaultPath?: string) {
    // Get vault path from constructor param or environment
    const finalVaultPath = vaultPath || process.env.OBSIDIAN_VAULT_PATH;
    
    if (!finalVaultPath) {
      throw new Error(
        'Missing OBSIDIAN_VAULT_PATH environment variable.\n' +
        'Create a .env file with your vault path.'
      );
    }

    this.vaultClient = new VaultClient(finalVaultPath);

    this.server = new Server(
      {
        name: 'obsidian-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupRequestHandlers();
  }

  private validateArgs<T>(args: unknown, required: Array<keyof T>): asserts args is T {
    if (!args || typeof args !== 'object') {
      throw new McpError(ErrorCode.InvalidParams, 'Arguments must be an object');
    }

    for (const key of required) {
      if (!(key in args)) {
        throw new McpError(ErrorCode.InvalidParams, `Missing required argument: ${String(key)}`);
      }
    }
  }

  private setupRequestHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_notes',
          description: 'Search notes by content, tags, or path',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              includeTags: { type: 'boolean', description: 'Include tag matches' },
              includePath: { type: 'boolean', description: 'Include path/title matches' },
              excludeFolders: { 
                type: 'array',
                items: { type: 'string' },
                description: 'Folders to exclude from search'
              },
              limit: { type: 'number', description: 'Maximum number of results' }
            },
            required: ['query']
          }
        },
        {
          name: 'get_note',
          description: 'Get note content and metadata',
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Path to the note (without .md extension)' }
            },
            required: ['path']
          }
        },
        {
          name: 'list_tags',
          description: 'Get all tags used in the vault',
          inputSchema: {
            type: 'object',
            properties: {
              minCount: { 
                type: 'number',
                description: 'Minimum number of times a tag must be used to be included'
              }
            }
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return this.handleToolCall(request.params.name, request.params.arguments);
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'obsidian://vault-stats',
          name: 'Vault Statistics',
          description: 'Basic statistics about the Obsidian vault',
          mimeType: 'application/json'
        }
      ]
    }));
  }

  async handleToolCall(name: string, args: unknown) {
    try {
      switch (name) {
        case 'search_notes': {
          this.validateArgs<SearchNotesArgs>(args, ['query']);
          const results = await this.vaultClient.searchNotes(args.query, {
            includeTags: args.includeTags,
            includePath: args.includePath,
            excludeFolders: args.excludeFolders,
            limit: args.limit
          });

          return {
            content: [{ 
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }]
          };
        }

        case 'get_note': {
          this.validateArgs<GetNoteArgs>(args, ['path']);
          const note = await this.vaultClient.getNoteByPath(args.path);
          
          if (!note) {
            throw new McpError(ErrorCode.InvalidParams, `Note not found: ${args.path}`);
          }

          return {
            content: [{ 
              type: 'text',
              text: JSON.stringify(note, null, 2)
            }]
          };
        }

        case 'list_tags': {
          const tags = await this.vaultClient.getAllTags();
          const { minCount = 0 } = args as GetTagsArgs;
          
          const filteredTags = tags.filter(t => t.count >= minCount);

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(filteredTags, null, 2)
            }]
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  async start() {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    console.error('Obsidian MCP server running on stdio');

    process.on('SIGINT', () => this.close());
  }

  async close() {
    if (this.transport) {
      await this.server.close();
      this.transport = undefined;
    }
  }
}

// Only start the server if this file is being run directly
if (require.main === module) {
  const server = new ObsidianServer();
  server.start().catch(console.error);
}