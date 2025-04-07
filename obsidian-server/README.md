# Obsidian MCP Server

Model Context Protocol server for Obsidian integration. This server provides tools to interact with an Obsidian vault programmatically.

## Features

- Search notes by content, tags, or path
- Get note content and metadata
- Parse YAML frontmatter
- Extract internal links
- Get all tags used in the vault
- Handle WikiLinks and Markdown links

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Copy `.env.example` to `.env` and configure your Obsidian vault path:
```bash
cp .env.example .env
```
4. Edit `.env` and set `OBSIDIAN_VAULT_PATH` to your Obsidian vault location

## Building

```bash
npm run build
```

## Running

```bash
npm start
```

## Available Tools

### search_notes
Search for notes in the vault by content, tags, or path.

Parameters:
- `query` (required): Search query string
- `includeTags` (optional): Include tag matches (default: false)
- `includePath` (optional): Include path/title matches (default: false)
- `excludeFolders` (optional): Array of folder paths to exclude from search
- `limit` (optional): Maximum number of results to return

### get_note
Get a specific note's content and metadata.

Parameters:
- `path` (required): Path to the note (without .md extension)

### list_tags
Get all tags used in the vault with their usage count.

Parameters:
- `minCount` (optional): Minimum number of times a tag must be used to be included

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| OBSIDIAN_VAULT_PATH | Path to your Obsidian vault | Required |
| EXCLUDED_FOLDERS | Folders to exclude from search (comma-separated) | Optional |
| CACHE_ENABLED | Enable caching for better performance | true |
| CACHE_TTL | Cache time-to-live in seconds | 3600 |

## Example Usage

```javascript
// Search notes containing "project"
await mcp.useTool('search_notes', {
  query: 'project',
  includeTags: true,
  includePath: true
});

// Get specific note content
await mcp.useTool('get_note', {
  path: 'folder/note'
});

// List all tags used at least 5 times
await mcp.useTool('list_tags', {
  minCount: 5
});