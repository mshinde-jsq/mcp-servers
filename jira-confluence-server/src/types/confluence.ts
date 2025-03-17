export interface ConfluencePage {
  id: string;
  type: 'page';
  status: 'current' | 'draft';
  title: string;
  body: {
    storage: {
      value: string;
      representation: 'storage' | 'view' | 'export_view' | 'styled_view';
    };
  };
  version: {
    number: number;
    by: {
      displayName: string;
      email: string;
    };
    when: string;
  };
  space: {
    key: string;
    name: string;
  };
  ancestors?: {
    id: string;
    title: string;
  }[];
  _links?: {
    webui: string;
    self?: string;
  };
  excerpt?: string;
}

export interface ConfluenceComment {
  id: string;
  type: 'comment';
  status: 'current' | 'deleted';
  body: {
    storage: {
      value: string;
      representation: 'storage';
    };
  };
  version: {
    number: number;
    by: {
      displayName: string;
      email: string;
    };
    when: string;
  };
}

export interface ConfluenceAttachment {
  id: string;
  type: 'attachment';
  title: string;
  metadata: {
    mediaType: string;
    size: number;
  };
  extensions: {
    location: string;
    mediaType: string;
    fileSize: number;
    comment?: string;
  };
}

// New interface for optimized page metadata
export interface ConfluencePageMetadata {
  id: string;
  title: string;
  space: {
    key: string;
    name: string;
  };
  _links: {
    webui: string;
  };
  excerpt?: string;
  lastModified: string;
}

// New interface for paginated metadata response
export interface PaginatedSearchResponse {
  results: ConfluencePageMetadata[];
  metadata: {
    start: number;
    limit: number;
    totalSize: number;
    hasNext: boolean;
    nextPageStart?: number;
  };
}

// Legacy search result interface (kept for backward compatibility)
export interface ConfluenceSearchResult {
  size: number;
  results: ConfluencePage[];
  start: number;
  limit: number;
  _links: {
    base: string;
    context: string;
    next?: string;
    self: string;
  };
}

// New interface for bulk content response
export interface BulkContentResponse {
  pages: Array<{
    id: string;
    content: string;
    error?: string;  // Optional error if a specific page fetch fails
  }>;
  metadata: {
    successCount: number;
    errorCount: number;
  };
}