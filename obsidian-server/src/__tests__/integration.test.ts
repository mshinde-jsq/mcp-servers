import { join } from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { ObsidianServer } from '../index.js';

describe('Obsidian MCP Server Integration Tests', () => {
  let server: ObsidianServer;
  const testVaultPath = join(__dirname, 'test-vault');

  beforeAll(async () => {
    // Set test environment
    process.env.OBSIDIAN_VAULT_PATH = testVaultPath;
    process.env.CACHE_ENABLED = 'false';

    server = new ObsidianServer();
    await server.start();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Note Retrieval', () => {
    test('should get note by path', async () => {
      const result = await server.handleToolCall('get_note', {
        path: 'note1'
      });

      expect(result.content).toHaveLength(1);
      const note = JSON.parse(result.content[0].text);
      
      expect(note).toMatchObject({
        path: 'note1.md',
        name: 'note1',
        metadata: {
          title: 'Test Note 1',
          tags: ['test', 'example', 'documentation']
        }
      });

      expect(note.content).toContain('This is a test note');
      expect(note.links.to).toContain('note2');
      expect(note.links.to).toContain('note3');
    });

    test('should handle notes in subfolders', async () => {
      const result = await server.handleToolCall('get_note', {
        path: 'subfolder/note3'
      });

      expect(result.content).toHaveLength(1);
      const note = JSON.parse(result.content[0].text);
      
      expect(note).toMatchObject({
        path: 'subfolder/note3.md',
        name: 'note3',
        metadata: {
          title: 'Test Note 3',
          tags: ['test', 'archived']
        }
      });
    });

    test('should return null for non-existent note', async () => {
      await expect(server.handleToolCall('get_note', {
        path: 'nonexistent'
      })).rejects.toThrow(McpError);
    });
  });

  describe('Search Functionality', () => {
    test('should search by content', async () => {
      const result = await server.handleToolCall('search_notes', {
        query: 'test note',
        includePath: false,
        includeTags: false
      });

      expect(result.content).toHaveLength(1);
      const searchResults = JSON.parse(result.content[0].text);
      
      expect(searchResults).toHaveLength(3); // All three notes contain "test note"
      expect(searchResults[0].matchType).toBe('content');
    });

    test('should search by tags', async () => {
      const result = await server.handleToolCall('search_notes', {
        query: 'documentation',
        includeTags: true
      });

      expect(result.content).toHaveLength(1);
      const searchResults = JSON.parse(result.content[0].text);
      
      expect(searchResults.some((r: any) => 
        r.note.metadata.tags.includes('documentation')
      )).toBe(true);
    });

    test('should exclude specified folders', async () => {
      const result = await server.handleToolCall('search_notes', {
        query: 'test',
        excludeFolders: ['subfolder']
      });

      expect(result.content).toHaveLength(1);
      const searchResults = JSON.parse(result.content[0].text);
      
      expect(searchResults.every((r: any) => 
        !r.note.path.startsWith('subfolder/')
      )).toBe(true);
    });
  });

  describe('Tag Management', () => {
    test('should list all tags with counts', async () => {
      const result = await server.handleToolCall('list_tags', {});

      expect(result.content).toHaveLength(1);
      const tags = JSON.parse(result.content[0].text);
      
      const testTag = tags.find((t: any) => t.tag === 'test');
      expect(testTag).toBeDefined();
      expect(testTag.count).toBe(3); // All three notes have #test
      
      const archivedTag = tags.find((t: any) => t.tag === 'archived');
      expect(archivedTag).toBeDefined();
      expect(archivedTag.count).toBe(1); // Only note3 has #archived
    });

    test('should filter tags by minimum count', async () => {
      const result = await server.handleToolCall('list_tags', {
        minCount: 2
      });

      expect(result.content).toHaveLength(1);
      const tags = JSON.parse(result.content[0].text);
      
      expect(tags.every((t: any) => t.count >= 2)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid tool name', async () => {
      await expect(server.handleToolCall('invalid_tool', {}))
        .rejects
        .toThrow(McpError);
    });

    test('should handle missing required arguments', async () => {
      await expect(server.handleToolCall('search_notes', {}))
        .rejects
        .toThrow(McpError);
    });

    test('should handle invalid search patterns', async () => {
      await expect(server.handleToolCall('search_notes', {
        query: '['  // Invalid regex pattern
      }))
        .rejects
        .toThrow(McpError);
    });
  });
});