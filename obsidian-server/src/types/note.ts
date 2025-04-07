export interface NoteMetadata {
  title: string;
  tags?: string[];
  aliases?: string[];
  created?: string;
  modified?: string;
  [key: string]: unknown; // Allow arbitrary frontmatter
}

export interface Note {
  path: string;         // Relative path within vault
  name: string;         // Filename without extension
  content: string;      // Raw markdown content
  metadata: NoteMetadata;
  links: {
    to: string[];      // Notes this note links to
    from: string[];    // Notes that link to this note
  };
}

export interface SearchResult {
  note: Note;
  excerpt?: string;     // Matching context if from content search
  matchType: 'content' | 'tag' | 'title';
  score: number;        // Relevance score
}