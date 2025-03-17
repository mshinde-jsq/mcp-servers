import { ConfluenceClient } from '../clients/confluence-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('Confluence Integration Tests', () => {
  let client: ConfluenceClient;

  beforeAll(() => {
    if (!process.env.CONFLUENCE_BASE_URL || !process.env.CONFLUENCE_TOKEN) {
      throw new Error('Confluence credentials not found in environment variables');
    }
    const email = 'mshinde@junipersquare.com';
    client = new ConfluenceClient(
      process.env.CONFLUENCE_BASE_URL,
      email,
      process.env.CONFLUENCE_TOKEN
    );
  });

  describe('Search Integration', () => {
    it('should successfully search for "Email knowledge transfer"', async () => {
      // Enable longer timeout for API call
      jest.setTimeout(10000);

      const query = 'Email knowledge transfer';
      const result = await client.searchPages(query);
      
      // Log the complete response for debugging
      console.log('Search Response:', JSON.stringify(result, null, 2));

      // Basic validation
      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);

      // Log matching page titles
      console.log('Found pages:');
      result.results.forEach(page => {
        console.log(`- ${page.title}`);
      });

      // Validate response structure
      if (result.results.length > 0) {
        const page = result.results[0];
        
        // Validate page properties
        expect(page).toHaveProperty('id');
        expect(page).toHaveProperty('type', 'page');
        expect(page).toHaveProperty('status', 'current');
        expect(page).toHaveProperty('title');
        expect(page).toHaveProperty('space');
        expect(page.space).toHaveProperty('key');
        expect(page).toHaveProperty('body.storage.value');
      }
    });
  });
});