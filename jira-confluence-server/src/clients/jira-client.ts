import axios, { AxiosInstance } from 'axios';
import { JiraIssue, JiraComment, JiraAttachment, JiraSearchResult } from '../types/jira.js';

export class JiraClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: `${baseUrl}/rest/api/3`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          const { status, data } = error.response;
          throw new Error(`Jira API Error (${status}): ${data.message || JSON.stringify(data)}`);
        }
        throw error;
      }
    );
  }

  // Issue operations
  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraSearchResult> {
    const response = await this.client.post('/search', {
      jql,
      maxResults,
      fields: [
        'summary',
        'description',
        'status',
        'issuetype',
        'priority',
        'assignee',
        'reporter',
        'created',
        'updated',
        'project'
      ]
    });
    return response.data;
  }

  async getIssue(issueKeyOrId: string): Promise<JiraIssue> {
    const response = await this.client.get(`/issue/${issueKeyOrId}`);
    return response.data;
  }

  async createIssue(projectKey: string, issueType: string, summary: string, description?: string): Promise<JiraIssue> {
    const response = await this.client.post('/issue', {
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary,
        description: description ? {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: description }]
          }]
        } : undefined
      }
    });
    return response.data;
  }

  async updateIssue(issueKeyOrId: string, fields: Partial<JiraIssue['fields']>): Promise<void> {
    await this.client.put(`/issue/${issueKeyOrId}`, { fields });
  }

  // Comments operations
  async getComments(issueKeyOrId: string): Promise<JiraComment[]> {
    const response = await this.client.get(`/issue/${issueKeyOrId}/comment`);
    return response.data.comments;
  }

  async addComment(issueKeyOrId: string, body: string): Promise<JiraComment> {
    const response = await this.client.post(`/issue/${issueKeyOrId}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: body }]
        }]
      }
    });
    return response.data;
  }

  // Attachments operations
  async getAttachments(issueKeyOrId: string): Promise<JiraAttachment[]> {
    const response = await this.client.get(`/issue/${issueKeyOrId}`);
    return response.data.fields.attachment || [];
  }

  async addAttachment(issueKeyOrId: string, filename: string, content: Buffer): Promise<JiraAttachment> {
    const formData = new FormData();
    const blob = new Blob([content]);
    formData.append('file', blob, filename);

    const response = await this.client.post(`/issue/${issueKeyOrId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Atlassian-Token': 'no-check'
      }
    });
    return response.data[0];
  }

  // Transitions
  async getTransitions(issueKeyOrId: string): Promise<any[]> {
    const response = await this.client.get(`/issue/${issueKeyOrId}/transitions`);
    return response.data.transitions;
  }

  async transitionIssue(issueKeyOrId: string, transitionId: string): Promise<void> {
    await this.client.post(`/issue/${issueKeyOrId}/transitions`, {
      transition: { id: transitionId }
    });
  }
}