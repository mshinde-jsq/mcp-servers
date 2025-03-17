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