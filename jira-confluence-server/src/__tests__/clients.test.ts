import { JiraClient } from '../clients/jira-client';
import { ConfluenceClient } from '../clients/confluence-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Axios create instance
const mockAxiosInstance = {
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

describe('JiraClient', () => {
  let client: JiraClient;

  beforeEach(() => {
    client = new JiraClient('https://test.atlassian.net', 'test-token');
    jest.clearAllMocks();
  });

  it('should search issues', async () => {
    const mockResponse = {
      data: {
        issues: [
          {
            id: '1',
            key: 'TEST-1',
            fields: {
              summary: 'Test Issue',
              status: { name: 'Open' },
              issuetype: { name: 'Bug' },
              project: { key: 'TEST', name: 'Test Project' },
              created: '2024-03-17T09:00:00.000Z',
              updated: '2024-03-17T09:00:00.000Z'
            }
          }
        ],
        total: 1
      }
    };

    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await client.searchIssues('project = TEST');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].key).toBe('TEST-1');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/search', expect.any(Object));
  });

  it('should create an issue', async () => {
    const mockResponse = {
      data: {
        id: '1',
        key: 'TEST-1',
        fields: {
          summary: 'New Issue',
          status: { name: 'Open' },
          issuetype: { name: 'Task' },
          project: { key: 'TEST', name: 'Test Project' }
        }
      }
    };

    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await client.createIssue('TEST', 'Task', 'New Issue');
    expect(result.key).toBe('TEST-1');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/issue', expect.any(Object));
  });
});

describe('ConfluenceClient', () => {
  let client: ConfluenceClient;

  beforeEach(() => {
    client = new ConfluenceClient(
      'https://test.atlassian.net/wiki',
      'test@example.com',
      'test-token'
    );
    jest.clearAllMocks();
  });

  it('should search pages', async () => {
    const mockResponse = {
      data: {
        results: [
          {
            id: '1',
            type: 'page',
            status: 'current',
            title: 'Test Page',
            body: {
              storage: {
                value: 'Test content',
                representation: 'storage'
              }
            },
            version: {
              number: 1,
              by: {
                displayName: 'Test User',
                email: 'test@example.com'
              },
              when: '2024-03-17T09:00:00.000Z'
            },
            space: {
              key: 'TEST',
              name: 'Test Space'
            }
          }
        ],
        size: 1,
        start: 0,
        limit: 25,
        _links: {
          base: 'https://test.atlassian.net/wiki',
          context: '/wiki',
          self: '/rest/api/content/search'
        }
      }
    };

    mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

    const result = await client.searchPages('test query');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe('Test Page');
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('search', expect.any(Object));
  });

  it('should properly serialize array parameters and CQL query', async () => {
    const paramsSerializerSpy = jest.fn(params => {
      if (Array.isArray(params.expand)) {
        return `cql=${encodeURIComponent(params.cql)}&expand=${params.expand.join(',')}`;
      }
      return '';
    });

    // Create a new instance with the spy
    const testClient = new ConfluenceClient(
      'https://test.atlassian.net/wiki',
      'test@example.com',
      'test-token'
    );
    mockedAxios.create.mockReturnValueOnce({
      ...mockAxiosInstance,
      defaults: {
        paramsSerializer: paramsSerializerSpy
      }
    } as any);

    const mockResponse = {
      data: { results: [] }
    };
    mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

    // Call searchPages which uses array parameters
    await testClient.searchPages('test query', 'TEST');

    // Verify params passed to serializer
    expect(paramsSerializerSpy).toHaveBeenCalledWith({
      cql: 'type=page AND text ~ "test query" AND space="TEST"',
      expand: ['body.storage', 'version', 'space']
    });

    // Verify the get call
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('search', {
      params: {
        cql: 'type=page AND text ~ "test query" AND space="TEST"',
        expand: ['body.storage', 'version', 'space']
      }
    });
  });

  it('should create a page', async () => {
    const mockResponse = {
      data: {
        id: '1',
        type: 'page',
        title: 'New Page',
        body: {
          storage: {
            value: 'Test content',
            representation: 'storage'
          }
        },
        version: {
          number: 1
        },
        space: {
          key: 'TEST',
          name: 'Test Space'
        }
      }
    };

    mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

    const result = await client.createPage('TEST', 'New Page', 'Test content');
    expect(result.title).toBe('New Page');
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('', expect.any(Object));
  });
});