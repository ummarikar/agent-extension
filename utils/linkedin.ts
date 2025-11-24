import type { Connection } from '../types';

export class LinkedInParser {
  /**
   * Extract person ID from LinkedIn profile page HTML
   */
  static extractPersonId(html: string): string | null {
    // Method 1: Look for profileUrn in href attributes (most reliable)
    // Pattern: profileUrn=urn%3Ali%3Afsd_profile%3A{ID}
    const profileUrnRegex = /profileUrn=urn%3Ali%3Afsd_profile%3A([A-Za-z0-9_-]+)/i;
    const profileUrnMatch = html.match(profileUrnRegex);

    if (profileUrnMatch && profileUrnMatch[1]) {
      console.log('Found person ID from profileUrn:', profileUrnMatch[1]);
      return profileUrnMatch[1];
    }

    // Method 2: Look for unencoded version
    const unencodedRegex = /urn:li:fsd_profile:([A-Za-z0-9_-]+)/i;
    const unencodedMatch = html.match(unencodedRegex);

    if (unencodedMatch && unencodedMatch[1]) {
      console.log('Found person ID from unencoded URN:', unencodedMatch[1]);
      return unencodedMatch[1];
    }

    // Method 3: Look for div with componentkey (old method, fallback)
    const componentkeyRegex = /componentkey="[^"]*ref([^"]+?)Topcard"/i;
    const componentkeyMatch = html.match(componentkeyRegex);

    if (componentkeyMatch && componentkeyMatch[1]) {
      console.log('Found person ID from componentkey:', componentkeyMatch[1]);
      return componentkeyMatch[1];
    }

    console.error('Could not extract person ID from page');
    return null;
  }

  /**
   * Extract company ID from currentCompany parameter in URL
   */
  static extractCompanyId(html: string): string | null {
    // Find links with currentCompany parameter
    const regex = /href="[^"]*currentCompany=%5B%22(\d+)%22%5D/i;
    const match = html.match(regex);

    if (match && match[1]) {
      return match[1];
    }

    // Try unencoded version
    const unencodedRegex = /currentCompany=\["(\d+)"\]/i;
    const unencodedMatch = html.match(unencodedRegex);

    if (unencodedMatch && unencodedMatch[1]) {
      return unencodedMatch[1];
    }

    return null;
  }

  /**
   * Build LinkedIn search URL for connections at a company
   */
  static buildConnectionsSearchUrl(
    personId: string,
    companyId: string,
    employmentType: 'current' | 'past',
    page: number = 1
  ): string {
    const baseUrl = 'https://www.linkedin.com/search/results/people/';
    const network = encodeURIComponent('["F","S","O"]');
    const connectionOf = encodeURIComponent(`["${personId}"]`);
    const companyParam = employmentType === 'current' ? 'currentCompany' : 'pastCompany';
    const companyValue = encodeURIComponent(`["${companyId}"]`);

    return `${baseUrl}?origin=FACETED_SEARCH&network=${network}&connectionOf=${connectionOf}&${companyParam}=${companyValue}&page=${page}`;
  }

  /**
   * Build LinkedIn search URL for connections at a school
   */
  static buildSchoolConnectionsSearchUrl(
    personId: string,
    schoolId: string,
    page: number = 1
  ): string {
    const baseUrl = 'https://www.linkedin.com/search/results/people/';
    const network = encodeURIComponent('["F","S","O"]');
    const connectionOf = encodeURIComponent(`["${personId}"]`);
    const schoolFilter = encodeURIComponent(`["${schoolId}"]`);

    return `${baseUrl}?origin=FACETED_SEARCH&network=${network}&schoolFilter=${schoolFilter}&connectionOf=${connectionOf}&page=${page}`;
  }

  /**
   * Check if there are more pages in search results
   */
  static hasNextPage(html: string): boolean {
    // Check for next button that's not disabled
    const nextButtonRegex = /<button[^>]+data-testid="pagination-controls-next-button-visible"[^>]*>/i;
    const match = html.match(nextButtonRegex);

    if (!match) return false;

    // Check if button is disabled
    const disabledRegex = /disabled/i;
    return !disabledRegex.test(match[0]);
  }
}

export function waitForSelector(
  selector: string,
  timeout: number = 30000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);

    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for selector: ${selector}`));
    }, timeout);
  });
}
