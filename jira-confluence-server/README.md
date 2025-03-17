# Jira/Confluence MCP Server

A Model Context Protocol server that provides integration with Jira and Confluence Cloud APIs.

## Features

### Jira Tools
- Search issues using JQL
- Create new issues
- Access issue details, comments, and attachments

### Confluence Tools
- Search pages
- Create new pages
- Access page content, comments, and attachments

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   - Edit `.env` and fill in your Jira and Confluence configuration:
   ```ini
   # Jira configuration
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_TOKEN=your-jira-api-token

   # Confluence configuration
   CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
   CONFLUENCE_TOKEN=your-confluence-api-token
   ```

To get your API tokens:
1. Log in to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name and copy the token value

4. Build the server:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

## Development

- Run in development mode with auto-reload:
```bash
npm run dev
```

- Watch mode for TypeScript compilation:
```bash
npm run watch
```

- Run tests:
```bash
npm test
```

## Available Tools

### jira_search_issues
Search for Jira issues using JQL.
```typescript
{
  jql: string;      // Required: JQL search query
  maxResults?: number; // Optional: Maximum number of results
}
```

### jira_create_issue
Create a new Jira issue.
```typescript
{
  projectKey: string;  // Required: Project key
  issueType: string;   // Required: Issue type (e.g., "Bug", "Task")
  summary: string;     // Required: Issue summary
  description?: string; // Optional: Issue description
}
```

### confluence_search_pages
Search for Confluence pages.
```typescript
{
  query: string;     // Required: Search query
  spaceKey?: string; // Optional: Space key to search in
}
```

### confluence_create_page
Create a new Confluence page.
```typescript
{
  spaceKey: string;  // Required: Space key
  title: string;     // Required: Page title
  content: string;   // Required: Page content in storage format
  parentId?: string; // Optional: Parent page ID
}
```

## Available Resources

### jira://issues
Access the most recently created Jira issues.

### confluence://pages
Access the most recently updated Confluence pages.

## Error Handling

The server uses standard MCP error codes:
- `InvalidParams`: Missing or invalid parameters
- `MethodNotFound`: Unknown tool name
- `InvalidRequest`: Unknown resource URI
- `InternalError`: API errors or other internal issues

## Claude Desktop Integration

This MCP server is configured to work with Claude Desktop. After starting the server, Claude will have access to all the tools and resources defined above.

## Security Notes

- Never commit your `.env` file to version control
- Keep your API tokens secure and rotate them periodically
- Use environment-specific `.env` files for different deployments
