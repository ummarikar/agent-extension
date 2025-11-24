import type { BrightDataConfig } from '../types';

export class BrightDataClient {
  private apiKey: string;
  private zone: string;

  constructor(config: BrightDataConfig) {
    this.apiKey = config.apiKey;
    this.zone = config.zone || 'mcp_unlocker';
  }

  async scrapeUrl(url: string): Promise<string> {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      url,
      zone: this.zone,
      format: 'raw',
    };

    try {
      const response = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bright Data API error: ${response.status} - ${errorText}`);
      }

      return await response.text();
    } catch (error) {
      throw new Error(`Failed to scrape URL: ${error}`);
    }
  }

  async extractConnectionsLink(url: string): Promise<string | null> {
    const html = await this.scrapeUrl(url);

    // Find link containing /search/results/people in href
    const regex = /<a[^>]+href="([^"]*\/search\/results\/people[^"]*)"/i;
    const match = html.match(regex);

    if (match && match[1]) {
      let href = match[1];

      // If it's a relative URL, make it absolute
      if (href.startsWith('/')) {
        href = `https://www.linkedin.com${href}`;
      }

      return href;
    }

    return null;
  }
}
