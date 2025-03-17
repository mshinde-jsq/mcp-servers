import axios, { AxiosInstance, AxiosError } from 'axios';
import { ConfluencePage, ConfluenceComment, ConfluenceAttachment, ConfluenceSearchResult } from '../types/confluence.js';

interface ConfluenceErrorResponse {
  message?: string;
  status?: number;
  statusCode?: number;
  error?: string;
  data?: any;
}

// Type guard for Axios errors
function isAxiosError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error);
}

// Helper function to handle errors
function handleApiError(error: unknown, context: string): never {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as ConfluenceErrorResponse;
    const message = data?.message || data?.error || error.message;
    throw new Error(`Confluence API Error (${status}) during ${context}: ${message}`);
  }
  throw error;
}

function handleSpecificError(error: unknown, status: number, defaultMessage: string): void {
  if (isAxiosError(error) && error.response?.status === status) {
    throw new Error(defaultMessage);
  }
  throw error;
}

export class ConfluenceClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, email: string, token: string) {
    this.baseUrl = baseUrl;
    
    const authString = `${email}:${token}`;
    console.log('Auth string (without encoding):', authString);
    const encodedAuth = Buffer.from(authString).toString('base64');
    console.log('Encoded auth string:', encodedAuth);
    
    this.client = axios.create({
      baseURL: `${baseUrl}/rest/api`,
      headers: {
        'Authorization': `Basic ${encodedAuth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      paramsSerializer: params => {
        // Log the params before serialization
        console.log('Request params before serialization:', params);
        // Convert array parameters to comma-separated values
        return Object.entries(params)
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return `${key}=${value.join(',')}`;
            }
            return `${key}=${encodeURIComponent(String(value))}`;
          })
          .join('&');
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          const { status, data } = error.response;
          throw new Error(`Confluence API Error (${status}): ${data.message || JSON.stringify(data)}`);
        }
        throw error;
      }
    );
  }

  // Page operations
  async searchPages(query: string, spaceKey?: string, start: number = 0, limit: number = 5): Promise<ConfluenceSearchResult> {
    const params = {
      cql: `type=page AND text ~ "${query}"${spaceKey ? ` AND space="${spaceKey}"` : ''}`,
      expand: ['body.storage', 'version', 'space'],
      start,
      limit
    };
    try {
      const response = await this.client.get('content/search', { params });
      console.log('Search Response:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      return handleApiError(error, 'searching pages');
    }
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    try {
      const response = await this.client.get(`content/${pageId}`, {
        params: {
          expand: ['body.storage', 'version', 'ancestors', 'space']
        }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, `getting page ${pageId}`);
    }
  }

  async createPage(spaceKey: string, title: string, content: string, parentId?: string): Promise<ConfluencePage> {
    try {
      const data = {
        type: 'page',
        title,
        space: { key: spaceKey },
        body: {
          storage: {
            value: content,
            representation: 'storage'
          }
        },
        ...(parentId && { ancestors: [{ id: parentId }] })
      };

      const response = await this.client.post('content', data);
      return response.data;
    } catch (error) {
      return handleApiError(error, `creating page in space ${spaceKey}`);
    }
  }

  async updatePage(pageId: string, title: string, content: string, version: number): Promise<ConfluencePage> {
    try {
      const data = {
        type: 'page',
        title,
        body: {
          storage: {
            value: content,
            representation: 'storage'
          }
        },
        version: { number: version + 1 }
      };

      const response = await this.client.put(`content/${pageId}`, data);
      return response.data;
    } catch (error) {
      return handleApiError(error, `updating page ${pageId}`);
    }
  }

  // Comments operations
  async getComments(pageId: string): Promise<ConfluenceComment[]> {
    try {
      const response = await this.client.get(`content/${pageId}/child/comment`, {
        params: {
          expand: ['body.storage', 'version']
        }
      });
      return response.data.results;
    } catch (error) {
      return handleApiError(error, `getting comments for page ${pageId}`);
    }
  }

  async addComment(pageId: string, content: string): Promise<ConfluenceComment> {
    try {
      const data = {
        type: 'comment',
        container: { id: pageId, type: 'page' },
        body: {
          storage: {
            value: content,
            representation: 'storage'
          }
        }
      };

      const response = await this.client.post('content', data);
      return response.data;
    } catch (error) {
      return handleApiError(error, `adding comment to page ${pageId}`);
    }
  }

  // Attachments operations
  async getAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
    try {
      const response = await this.client.get(`content/${pageId}/child/attachment`, {
        params: {
          expand: ['version', 'extensions']
        }
      });
      return response.data.results;
    } catch (error) {
      return handleApiError(error, `getting attachments for page ${pageId}`);
    }
  }

  async addAttachment(pageId: string, filename: string, content: Buffer): Promise<ConfluenceAttachment> {
    try {
      const formData = new FormData();
      const blob = new Blob([content]);
      formData.append('file', blob, filename);

      const response = await this.client.post(`content/${pageId}/child/attachment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Atlassian-Token': 'no-check'
        }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, `adding attachment ${filename} to page ${pageId}`);
    }
  }

  // Space operations
  async getSpaces(): Promise<any[]> {
    try {
      const response = await this.client.get('space', {
        params: {
          type: 'global',
          status: 'current',
          expand: ['description']
        }
      });
      return response.data.results;
    } catch (error) {
      return handleApiError(error, 'getting spaces');
    }
  }

  // Convert HTML to Storage format (Confluence Wiki Markup)
  async convertHtmlToStorage(html: string): Promise<string> {
    try {
      const response = await this.client.post('contentbody/convert/storage', {
        value: html,
        representation: 'editor'
      });
      return response.data.value;
    } catch (error) {
      return handleApiError(error, 'converting HTML to storage format');
    }
  }
}