import { promises as fs } from 'fs';
import { join, relative } from 'path';
import * as yaml from 'js-yaml';
import { Note, NoteMetadata, SearchResult } from '../types/note';

export class VaultClient {
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  private async readMarkdownFile(path: string): Promise<{ content: string; metadata: NoteMetadata }> {
    const content = await fs.readFile(path, 'utf-8');
    
    // Parse YAML frontmatter if present
    let metadata: NoteMetadata = { title: '' };
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (frontmatterMatch) {
      try {
        metadata = yaml.load(frontmatterMatch[1]) as NoteMetadata;
        return { 
          content: frontmatterMatch[2].trim(),
          metadata
        };
      } catch (e) {
        console.error(`Error parsing frontmatter for ${path}:`, e);
      }
    }

    // If no frontmatter or parsing failed, use filename as title
    const name = path.split('/').pop()?.replace(/\.md$/, '') || '';
    metadata.title = metadata.title || name;
    
    return { content, metadata };
  }

  private parseInternalLinks(content: string): string[] {
    // Match both [[WikiLinks]] and [MDLinks](path/to/note.md)
    const wikiLinkRegex = /\[\[(.*?)\]\]/g;
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    
    const links = new Set<string>();
    
    // Extract WikiLinks
    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.add(match[1].split('|')[0]); // Handle [[Note|Alias]] syntax
    }
    
    // Extract Markdown links
    while ((match = mdLinkRegex.exec(content)) !== null) {
      links.add(match[2].replace(/\.md$/, ''));
    }
    
    return Array.from(links);
  }

  async getNoteByPath(notePath: string): Promise<Note | null> {
    const fullPath = join(this.vaultPath, `${notePath}.md`);
    
    try {
      const { content, metadata } = await this.readMarkdownFile(fullPath);
      const links = this.parseInternalLinks(content);
      
      // Get stats for created/modified dates
      const stats = await fs.stat(fullPath);
      
      return {
        path: relative(this.vaultPath, fullPath),
        name: notePath.split('/').pop() || '',
        content,
        metadata: {
          ...metadata,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString()
        },
        links: {
          to: links,
          from: [] // Will be populated by graph service
        }
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw e;
    }
  }

  async searchNotes(query: string, options: {
    includeTags?: boolean;
    includePath?: boolean;
    excludeFolders?: string[];
    limit?: number;
  } = {}): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    
    // Recursively get all .md files
    async function* walkFiles(dir: string): AsyncGenerator<string> {
      const files = await fs.readdir(dir, { withFileTypes: true });
      
      for (const file of files) {
        const path = join(dir, file.name);
        
        if (options.excludeFolders?.some(folder => path.includes(folder))) {
          continue;
        }
        
        if (file.isDirectory()) {
          yield* walkFiles(path);
        } else if (file.name.endsWith('.md')) {
          yield path;
        }
      }
    }

    // Search through all markdown files
    for await (const path of walkFiles(this.vaultPath)) {
      if (results.length >= (options.limit || Infinity)) break;
      
      const relativePath = relative(this.vaultPath, path);
      if (seen.has(relativePath)) continue;
      
      const note = await this.getNoteByPath(relativePath.replace(/\.md$/, ''));
      if (!note) continue;
      
      seen.add(relativePath);
      
      // Search in content
      if (note.content.toLowerCase().includes(query.toLowerCase())) {
        const index = note.content.toLowerCase().indexOf(query.toLowerCase());
        const start = Math.max(0, index - 40);
        const end = Math.min(note.content.length, index + query.length + 40);
        
        results.push({
          note,
          excerpt: '...' + note.content.slice(start, end) + '...',
          matchType: 'content',
          score: 1
        });
      }
      
      // Search in tags
      if (options.includeTags && note.metadata.tags?.some(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      )) {
        results.push({
          note,
          matchType: 'tag',
          score: 2
        });
      }
      
      // Search in path/title
      if (options.includePath && (
        note.path.toLowerCase().includes(query.toLowerCase()) ||
        note.metadata.title.toLowerCase().includes(query.toLowerCase())
      )) {
        results.push({
          note,
          matchType: 'title',
          score: 3
        });
      }
    }
    
    // Sort by score (higher is better)
    return results.sort((a, b) => b.score - a.score);
  }

  async getAllTags(): Promise<{ tag: string; count: number }[]> {
    const tagCounts = new Map<string, number>();
    
    for await (const path of await fs.readdir(this.vaultPath)) {
      if (!path.endsWith('.md')) continue;
      
      const note = await this.getNoteByPath(path.replace(/\.md$/, ''));
      if (!note?.metadata.tags) continue;
      
      for (const tag of note.metadata.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }
}