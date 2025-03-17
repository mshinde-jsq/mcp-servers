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
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { JiraClient } from './clients/jira-client.js';
import { ConfluenceClient } from './clients/confluence-client.js';

// Load environment variables from .env file
config({ path: join(process.cwd(), '.env') });

interface EnvVars {
  JIRA_BASE_URL: string;
  JIRA_TOKEN: string;
  CONFLUENCE_BASE_URL: string;
  CONFLUENCE_TOKEN: string;
}

// Get environment variables
const envVars: Partial<EnvVars> = {
  JIRA_BASE_URL: process.env.JIRA_BASE_URL,
  JIRA_TOKEN: process.env.JIRA_TOKEN,
  CONFLUENCE_BASE_URL: process.env.CONFLUENCE_BASE_URL,
  CONFLUENCE_TOKEN: process.env.CONFLUENCE_TOKEN,
};

// Validate environment variables
const missingVars = Object.entries(envVars).filter(([_, value]) => !value);
if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.map(([key]) => key).join(', ')}\n` +
    'Create a .env file based on .env.example with your configuration.'
  );
}

// Now TypeScript knows these are non-null
const {
  JIRA_BASE_URL,
  JIRA_TOKEN,
  CONFLUENCE_BASE_URL,
  CONFLUENCE_TOKEN
} = envVars as EnvVars;

interface JiraSearchArgs {
  jql: string;
  maxResults?: number;
}

interface JiraCreateIssueArgs {
  projectKey: string;
  issueType: string;
  summary: string;
  description?: string;
}

interface ConfluenceSearchArgs {
  query: string;
  spaceKey?: string;
  start?: number;
  limit?: number;
}

interface ConfluenceCreatePageArgs {
  spaceKey: string;
  title: string;
  content: string;
  parentId?: string;
}

class JiraConfluenceServer {
  private server: Server;
  private jiraClient: JiraClient;
  private confluenceClient: ConfluenceClient;

  constructor() {
    this.jiraClient = new JiraClient(JIRA_BASE_URL, JIRA_TOKEN);
    this.confluenceClient = new ConfluenceClient(
      CONFLUENCE_BASE_URL,
      'mshinde@junipersquare.com',
      CONFLUENCE_TOKEN
    );

    this.server = new Server(
      {
        name: 'jira-confluence-server',
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
          name: 'jira_search_issues',
          description: 'Search for Jira issues using JQL',
          inputSchema: {
            type: 'object',
            properties: {
              jql: { type: 'string', description: 'JQL search query' },
              maxResults: { type: 'number', description: 'Maximum number of results to return' }
            },
            required: ['jql']
          }
        },
        {
          name: 'jira_create_issue',
          description: 'Create a new Jira issue',
          inputSchema: {
            type: 'object',
            properties: {
              projectKey: { type: 'string', description: 'Project key' },
              issueType: { type: 'string', description: 'Issue type (e.g., "Bug", "Task")' },
              summary: { type: 'string', description: 'Issue summary' },
              description: { type: 'string', description: 'Issue description' }
            },
            required: ['projectKey', 'issueType', 'summary']
          }
        },
        {
          name: 'confluence_search_pages',
          description: 'Search for Confluence pages with optimized response size (default limit: 25)',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              spaceKey: { type: 'string', description: 'Space key to search in' },
              start: { type: 'number', description: 'Starting index for pagination (default: 0)' },
              limit: { type: 'number', description: 'Maximum number of results to return (default: 25)' }
            },
            required: ['query']
          }
        },
        {
          name: 'confluence_get_page_content',
          description: 'Get full content for a specific Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              pageId: { type: 'string', description: 'ID of the page to fetch' }
            },
            required: ['pageId']
          }
        },
        {
          name: 'confluence_bulk_get_pages',
          description: 'Get content for multiple Confluence pages (max 10)',
          inputSchema: {
            type: 'object',
            properties: {
              pageIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of page IDs to fetch',
                maxItems: 10
              }
            },
            required: ['pageIds']
          }
        },
        {
          name: 'confluence_create_page',
          description: 'Create a new Confluence page',
          inputSchema: {
            type: 'object',
            properties: {
              spaceKey: { type: 'string', description: 'Space key' },
              title: { type: 'string', description: 'Page title' },
              content: { type: 'string', description: 'Page content in storage format' },
              parentId: { type: 'string', description: 'Parent page ID' }
            },
            required: ['spaceKey', 'title', 'content']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'jira_search_issues': {
            this.validateArgs<JiraSearchArgs>(args, ['jql']);
            const result = await this.jiraClient.searchIssues(args.jql, args.maxResults);
            
            // Transform and sanitize the result to ensure it's valid JSON
            const sanitizedResult = JSON.parse(JSON.stringify(result));
            
            return {
              content: [{ type: 'text', text: JSON.stringify(sanitizedResult) }]
            };
          }

          case 'jira_create_issue': {
            this.validateArgs<JiraCreateIssueArgs>(args, ['projectKey', 'issueType', 'summary']);
            const issue = await this.jiraClient.createIssue(
              args.projectKey,
              args.issueType,
              args.summary,
              args.description
            );
            
            // Transform and sanitize the result to ensure it's valid JSON
            const sanitizedIssue = JSON.parse(JSON.stringify(issue));
            
            return {
              content: [{ type: 'text', text: JSON.stringify(sanitizedIssue) }]
            };
          }

          case 'confluence_search_pages': {
            this.validateArgs<ConfluenceSearchArgs>(args, ['query']);
            
            // Ensure the query isn't empty after trimming
            const query = args.query.trim();
            if (!query) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Search query cannot be empty'
              );
            }
            
            const result = await this.confluenceClient.searchPagesOptimized(
              query,
              args.spaceKey,
              args.start,
              args.limit
            );
            
            // Transform and sanitize the result to ensure it's valid JSON
            const sanitizedResult = JSON.parse(JSON.stringify(result));
            
            return {
              content: [{ type: 'text', text: JSON.stringify(sanitizedResult) }]
            };
          }

          case 'confluence_get_page_content': {
            this.validateArgs<{ pageId: string }>(args, ['pageId']);
            const page = await this.confluenceClient.getPageContent(args.pageId);
            
            // Transform and sanitize the result to ensure it's valid JSON
            const sanitizedPage = JSON.parse(JSON.stringify(page));
            
            return {
              content: [{ type: 'text', text: JSON.stringify(sanitizedPage) }]
            };
          }

          case 'confluence_bulk_get_pages': {
            this.validateArgs<{ pageIds: string[] }>(args, ['pageIds']);
            
            if (!Array.isArray(args.pageIds)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'pageIds must be an array'
              );
            }

            if (args.pageIds.length > 10) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Cannot fetch more than 10 pages at once'
              );
            }

            const result = await this.confluenceClient.bulkGetPages(args.pageIds);
            
            // Transform and sanitize the result to ensure it's valid JSON
            const sanitizedResult = JSON.parse(JSON.stringify(result));
            
            return {
              content: [{ type: 'text', text: JSON.stringify(sanitizedResult) }]
            };
          }

          case 'confluence_create_page': {
            this.validateArgs<ConfluenceCreatePageArgs>(args, ['spaceKey', 'title', 'content']);
            const page = await this.confluenceClient.createPage(
              args.spaceKey,
              args.title,
              args.content,
              args.parentId
            );
            
            // Transform and sanitize the result to ensure it's valid JSON
            const sanitizedPage = JSON.parse(JSON.stringify(page));
            
            return {
              content: [{ type: 'text', text: JSON.stringify(sanitizedPage) }]
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
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'jira://issues',
          name: 'Jira Issues',
          description: 'Access Jira issues',
          mimeType: 'application/json'
        },
        {
          uri: 'confluence://pages',
          name: 'Confluence Pages',
          description: 'Access Confluence pages',
          mimeType: 'application/json'
        }
      ]
    }));

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        if (uri === 'jira://issues') {
          const issues = await this.jiraClient.searchIssues('order by created DESC', 10);
          
          // Transform and sanitize the result to ensure it's valid JSON
          const sanitizedIssues = JSON.parse(JSON.stringify(issues));
          
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(sanitizedIssues)
            }]
          };
        } else if (uri === 'confluence://pages') {
          // Use a query that will return recent pages instead of an empty query
          const pages = await this.confluenceClient.searchPages('order by lastmodified desc');
          
          // Transform and sanitize the result to ensure it's valid JSON
          const sanitizedPages = JSON.parse(JSON.stringify(pages));
          
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(sanitizedPages)
            }]
          };
        }

        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Jira/Confluence MCP server running on stdio');

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }
}

const server = new JiraConfluenceServer();
server.start().catch(console.error);