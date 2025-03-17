import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  ConfluencePage, 
  ConfluenceComment, 
  ConfluenceAttachment, 
  ConfluenceSearchResult,
  PaginatedSearchResponse,
  ConfluencePageMetadata,
  BulkContentResponse
} from '../types/confluence.js';

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

// Max number of pages that can be fetched in bulk
const MAX_BULK_PAGES = 10;

export class ConfluenceClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string, email: string, token: string) {
    this.baseUrl = baseUrl;
    
    const authString = `${email}:${token}`;
    const encodedAuth = Buffer.from(authString).toString('base64');
    
    this.client = axios.create({
      baseURL: `${baseUrl}/rest/api`,
      headers: {
        'Authorization': `Basic ${encodedAuth}`,
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
          throw new Error(`Confluence API Error (${status}): ${data.message || JSON.stringify(data)}`);
        }
        throw error;
      }
    );
  }

  // New optimized search method with pagination
  async searchPagesOptimized(
    query: string, 
    spaceKey?: string, 
    start: number = 0, 
    limit: number = 25
  ): Promise<PaginatedSearchResponse> {
    try {
      // Ensure query is not empty - provide a fallback if it is
      const searchQuery = query?.trim() || 'order by lastmodified desc';
      
      // Construct CQL query
      let cqlQuery = `type=page`;
      
      // Only add text search if query is provided and not empty
      if (searchQuery && !searchQuery.startsWith('order by')) {
        cqlQuery += ` AND text ~ "${searchQuery}"`;
      } else if (searchQuery.startsWith('order by')) {
        cqlQuery += ` ${searchQuery}`;
      }
      
      // Add space filter if provided
      if (spaceKey) {
        cqlQuery += ` AND space="${spaceKey}"`;
      }
      
      const response = await this.client.get('content/search', { 
        params: {
          cql: cqlQuery,
          expand: 'space,version,_links',
          start,
          limit
        }
      });

      const searchResult = response.data;
      
      // Transform the response into our optimized format
      const pageMetadata: ConfluencePageMetadata[] = searchResult.results.map((page: ConfluencePage) => ({
        id: page.id,
        title: page.title,
        space: page.space,
        _links: page._links || { webui: `${this.baseUrl}/wiki/spaces/${page.space.key}/pages/${page.id}` },
        excerpt: page.excerpt || '',
        lastModified: page.version.when
      }));

      return {
        results: pageMetadata,
        metadata: {
          start: searchResult.start,
          limit: searchResult.limit,
          totalSize: searchResult.size,
          hasNext: !!searchResult._links.next,
          nextPageStart: searchResult._links.next ? start + limit : undefined
        }
      };
    } catch (error) {
      return handleApiError(error, 'searching pages');
    }
  }

  // Legacy search method (kept for backward compatibility)
  async searchPages(query: string, spaceKey?: string, start: number = 0, limit: number = 5): Promise<ConfluenceSearchResult> {
    try {
      // Ensure query is not empty - provide a fallback if it is
      const searchQuery = query?.trim() || 'order by lastmodified desc';
      
      // Construct CQL query
      let cqlQuery = `type=page`;
      
      if (searchQuery && !searchQuery.startsWith('order by')) {
        cqlQuery += ` AND text ~ "${searchQuery}"`;
      } else if (searchQuery.startsWith('order by')) {
        cqlQuery += ` ${searchQuery}`;
      }
      
      if (spaceKey) {
        cqlQuery += ` AND space="${spaceKey}"`;
      }
      
      const response = await this.client.get('content/search', { 
        params: {
          cql: cqlQuery,
          expand: 'body.storage,version,space',
          start,
          limit
        }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'searching pages');
    }
  }

  // Get full content for a single page
  async getPageContent(pageId: string): Promise<ConfluencePage> {
    try {
      const response = await this.client.get(`content/${pageId}`, {
        params: {
          expand: 'body.storage,version,ancestors,space'
        }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, `getting page ${pageId}`);
    }
  }

  // New method for bulk fetching page content
  async bulkGetPages(pageIds: string[]): Promise<BulkContentResponse> {
    if (pageIds.length > MAX_BULK_PAGES) {
      throw new Error(`Cannot fetch more than ${MAX_BULK_PAGES} pages at once`);
    }

    const results = await Promise.allSettled(
      pageIds.map(id => this.getPageContent(id))
    );

    const pages = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          id: pageIds[index],
          content: result.value.body.storage.value
        };
      } else {
        return {
          id: pageIds[index],
          content: '',
          error: result.reason.message
        };
      }
    });

    const errorCount = pages.filter(page => 'error' in page).length;

    return {
      pages,
      metadata: {
        successCount: pages.length - errorCount,
        errorCount
      }
    };
  }

  async getPage(pageId: string): Promise<ConfluencePage> {
    try {
      const response = await this.client.get(`content/${pageId}`, {
        params: {
          expand: 'body.storage,version,ancestors,space'
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

  async getComments(pageId: string): Promise<ConfluenceComment[]> {
    try {
      const response = await this.client.get(`content/${pageId}/child/comment`, {
        params: {
          expand: 'body.storage,version'
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

  async getAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
    try {
      const response = await this.client.get(`content/${pageId}/child/attachment`, {
        params: {
          expand: 'version,extensions'
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

  async getSpaces(): Promise<any[]> {
    try {
      const response = await this.client.get('space', {
        params: {
          type: 'global',
          status: 'current',
          expand: 'description'
        }
      });
      return response.data.results;
    } catch (error) {
      return handleApiError(error, 'getting spaces');
    }
  }

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