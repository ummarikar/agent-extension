import type { Connection, ExtensionMessage } from '../types';
import { LinkedInParser } from './linkedin';

/**
 * Send message to content script and get response
 */
async function sendToContentScript(
  tabId: number,
  message: ExtensionMessage
): Promise<any> {
  try {
    const response = await browser.tabs.sendMessage(tabId, message);
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    return response.data;
  } catch (error) {
    throw new Error(`Failed to communicate with content script: ${error}`);
  }
}

/**
 * Wait for tab to finish loading
 */
async function waitForTabLoad(tabId: number, timeout: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      listener && browser.tabs.onUpdated.removeListener(listener);
      console.warn(`Tab ${tabId} timed out after ${timeout}ms`);
      resolve(false); // Return false on timeout instead of throwing
    }, timeout);

    const listener = (updatedTabId: number, changeInfo: any) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeoutId);
        browser.tabs.onUpdated.removeListener(listener);
        // Extra buffer for LinkedIn's dynamic content
        setTimeout(() => resolve(true), 2000);
      }
    };

    browser.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Close tab and create a fresh one
 */
async function resetLinkedInTab(oldTabId?: number): Promise<number> {
  console.log('Resetting LinkedIn tab...');

  // Close old tab if it exists
  if (oldTabId) {
    try {
      await browser.tabs.remove(oldTabId);
      console.log(`Closed stuck tab ${oldTabId}`);
    } catch (error) {
      console.warn('Failed to close old tab:', error);
    }
  }

  // Create fresh tab
  const tab = await browser.tabs.create({
    url: 'https://www.linkedin.com',
    active: true,
  });

  if (!tab.id) {
    throw new Error('Failed to create fresh tab');
  }

  const loaded = await waitForTabLoad(tab.id);
  if (!loaded) {
    throw new Error('Fresh tab failed to load - LinkedIn may be down');
  }

  console.log(`Created fresh LinkedIn tab ${tab.id}`);
  return tab.id;
}

/**
 * Find or create LinkedIn tab
 */
async function getLinkedInTab(url?: string): Promise<number> {
  // Try to find existing LinkedIn tab
  const tabs = await browser.tabs.query({ url: '*://*.linkedin.com/*' });

  if (tabs.length > 0 && tabs[0].id) {
    const tabId = tabs[0].id;

    // Navigate to URL if provided
    if (url) {
      await browser.tabs.update(tabId, { url, active: true });
      const loaded = await waitForTabLoad(tabId);

      // If page didn't load, reset the tab
      if (!loaded) {
        console.warn('Page failed to load, resetting tab...');
        return await resetLinkedInTab(tabId);
      }
    }
    return tabId;
  }

  // Create new tab
  const tab = await browser.tabs.create({
    url: url || 'https://www.linkedin.com',
    active: true,
  });

  if (!tab.id) {
    throw new Error('Failed to create tab');
  }

  const loaded = await waitForTabLoad(tab.id);
  if (!loaded) {
    throw new Error('Initial tab failed to load - LinkedIn may be down');
  }

  return tab.id;
}

/**
 * Tool: Get Company ID from Profile
 */
export async function getCompanyIdFromProfile(args: {
  profile_url: string;
}): Promise<any> {
  try {
    const tabId = await getLinkedInTab(args.profile_url);

    // Wait for page to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const result = await sendToContentScript(tabId, {
      type: 'GET_COMPANY_ID',
    });

    if (result.companyId) {
      return { companyId: result.companyId };
    } else {
      return { error: 'Could not find company information on profile page' };
    }
  } catch (error) {
    return { error: String(error) };
  }
}

/**
 * Tool: Get School ID from School Page
 */
export async function getSchoolIdFromPage(args: {
  school_url: string;
}): Promise<any> {
  try {
    const tabId = await getLinkedInTab(args.school_url);

    // Wait for page to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const result = await sendToContentScript(tabId, {
      type: 'GET_SCHOOL_ID',
    });

    if (result.schoolId) {
      return { schoolId: result.schoolId };
    } else {
      return { error: 'Could not find school information on page' };
    }
  } catch (error) {
    return { error: String(error) };
  }
}

/**
 * Fetch employees with pagination for a specific employment type
 */
async function fetchEmployeesByType(
  tabId: number,
  personId: string,
  companyId: string,
  employmentType: 'current' | 'past',
  maxPages: number = 10
): Promise<{ connections: Connection[], tabId: number }> {
  const connections: Connection[] = [];
  let currentTabId = tabId;
  let page = 1;

  console.log(`Fetching ${employmentType.toUpperCase()} employees...`);

  while (page <= maxPages) {
    const url = LinkedInParser.buildConnectionsSearchUrl(
      personId,
      companyId,
      employmentType,
      page
    );

    await browser.tabs.update(currentTabId, { url });
    const loaded = await waitForTabLoad(currentTabId);

    // If page didn't load, reset and retry
    if (!loaded) {
      console.warn('Connection search page stuck, resetting tab...');
      currentTabId = await resetLinkedInTab(currentTabId);
      await browser.tabs.update(currentTabId, { url });
      await waitForTabLoad(currentTabId);
    }

    const parseResult = await sendToContentScript(currentTabId, {
      type: 'PARSE_CONNECTIONS',
      payload: { employmentStatus: employmentType },
    });

    const pageConnections = parseResult.connections || [];

    console.log(
      `Found ${pageConnections.length} ${employmentType} employees on page ${page}`
    );

    if (pageConnections.length === 0) {
      break;
    }

    connections.push(...pageConnections);
    page++;
  }

  return { connections, tabId: currentTabId };
}

/**
 * Fetch alumni with pagination for a school
 */
async function fetchAlumniBySchool(
  tabId: number,
  personId: string,
  schoolId: string,
  maxPages: number = 10
): Promise<{ connections: Connection[], tabId: number }> {
  const connections: Connection[] = [];
  let currentTabId = tabId;
  let page = 1;

  console.log('Fetching school alumni...');

  while (page <= maxPages) {
    const url = LinkedInParser.buildSchoolConnectionsSearchUrl(
      personId,
      schoolId,
      page
    );

    await browser.tabs.update(currentTabId, { url });
    const loaded = await waitForTabLoad(currentTabId);

    // If page didn't load, reset and retry
    if (!loaded) {
      console.warn('Connection search page stuck, resetting tab...');
      currentTabId = await resetLinkedInTab(currentTabId);
      await browser.tabs.update(currentTabId, { url });
      await waitForTabLoad(currentTabId);
    }

    const parseResult = await sendToContentScript(currentTabId, {
      type: 'PARSE_CONNECTIONS',
      payload: { employmentStatus: 'alumni' },
    });

    const pageConnections = parseResult.connections || [];

    console.log(
      `Found ${pageConnections.length} alumni on page ${page}`
    );

    if (pageConnections.length === 0) {
      break;
    }

    connections.push(...pageConnections);
    page++;
  }

  return { connections, tabId: currentTabId };
}

/**
 * Tool: Get Connections
 */
export async function getConnections(args: {
  person_profile_url: string;
  company: boolean;
  id: string;
}): Promise<any> {
  try {
    // Step 1: Navigate to profile and extract person ID
    let tabId = await getLinkedInTab(args.person_profile_url);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const personIdResult = await sendToContentScript(tabId, {
      type: 'EXTRACT_PERSON_ID',
    });

    if (!personIdResult.personId) {
      return { error: 'Could not extract person ID from profile page' };
    }

    const personId = personIdResult.personId;
    console.log(`Extracted person ID: ${personId}`);

    const allConnections: Connection[] = [];

    if (args.company) {
      // Step 2a: Get current employees
      const currentResult = await fetchEmployeesByType(tabId, personId, args.id, 'current');
      allConnections.push(...currentResult.connections);
      tabId = currentResult.tabId;

      // Step 2b: Get past employees
      const pastResult = await fetchEmployeesByType(tabId, personId, args.id, 'past');
      allConnections.push(...pastResult.connections);
      tabId = pastResult.tabId;

      // Format response for company
      const currentConnections = allConnections.filter(
        (c) => c.employment_status === 'current'
      );
      const pastConnections = allConnections.filter(
        (c) => c.employment_status === 'past'
      );

      return {
        total: allConnections.length,
        currentEmployees: currentConnections.map(c => ({
          name: c.name,
          profileLink: c.profile_link
        })),
        pastEmployees: pastConnections.map(c => ({
          name: c.name,
          profileLink: c.profile_link
        }))
      };
    } else {
      // Step 2: Get school alumni
      const alumniResult = await fetchAlumniBySchool(tabId, personId, args.id);
      allConnections.push(...alumniResult.connections);

      // Format response for school
      return {
        total: allConnections.length,
        alumni: allConnections.map(c => ({
          name: c.name,
          profileLink: c.profile_link
        }))
      };
    }
  } catch (error) {
    return { error: String(error) };
  }
}
