export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    priority?: {
      name: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
    };
    reporter?: {
      displayName: string;
      emailAddress: string;
    };
    created: string;
    updated: string;
    project: {
      key: string;
      name: string;
    };
  };
}

export interface JiraComment {
  id: string;
  author: {
    displayName: string;
    emailAddress: string;
  };
  body: string;
  created: string;
  updated: string;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  content: string;
  mimeType: string;
  created: string;
  size: number;
}

export interface JiraSearchResult {
  total: number;
  issues: JiraIssue[];
}