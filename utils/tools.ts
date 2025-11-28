import type { Connection, ExtensionMessage } from "../types";
import { LinkedInParser } from "./linkedin";
import { getConfig } from "./config";
import { AzureOpenAI } from "openai";
import { logger } from "./logger";

/**
 * Send message to content script and get response
 */
async function sendToContentScript(
  tabId: number,
  message: ExtensionMessage,
): Promise<any> {
  try {
    const response = await browser.tabs.sendMessage(tabId, message);
    if (!response.success) {
      throw new Error(response.error || "Unknown error");
    }
    return response.data;
  } catch (error) {
    throw new Error(`Failed to communicate with content script: ${error}`);
  }
}

/**
 * Wait for tab to finish loading
 */
async function waitForTabLoad(
  tabId: number,
  timeout: number = 30000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      listener && browser.tabs.onUpdated.removeListener(listener);
      logger.warn(`Tab ${tabId} timed out after ${timeout}ms`);
      resolve(false); // Return false on timeout instead of throwing
    }, timeout);

    const listener = (updatedTabId: number, changeInfo: any) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
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
  logger.info("Resetting LinkedIn tab...");

  // Close old tab if it exists
  if (oldTabId) {
    try {
      await browser.tabs.remove(oldTabId);
      logger.info(`Closed stuck tab ${oldTabId}`);
    } catch (error) {
      logger.warn("Failed to close old tab:", error);
    }
  }

  // Create fresh tab
  const tab = await browser.tabs.create({
    url: "https://www.linkedin.com",
    active: true,
  });

  if (!tab.id) {
    throw new Error("Failed to create fresh tab");
  }

  const loaded = await waitForTabLoad(tab.id);
  if (!loaded) {
    throw new Error("Fresh tab failed to load - LinkedIn may be down");
  }

  logger.info(`Created fresh LinkedIn tab ${tab.id}`);
  return tab.id;
}

/**
 * Find or create LinkedIn tab
 */
async function getLinkedInTab(url?: string): Promise<number> {
  // Try to find existing LinkedIn tab
  const tabs = await browser.tabs.query({ url: "*://*.linkedin.com/*" });

  if (tabs.length > 0 && tabs[0].id) {
    const tabId = tabs[0].id;

    // Navigate to URL if provided
    if (url) {
      await browser.tabs.update(tabId, { url, active: true });
      const loaded = await waitForTabLoad(tabId);

      // If page didn't load, reset the tab
      if (!loaded) {
        logger.warn("Page failed to load, resetting tab...");
        return await resetLinkedInTab(tabId);
      }
    }
    return tabId;
  }

  // Create new tab
  const tab = await browser.tabs.create({
    url: url || "https://www.linkedin.com",
    active: true,
  });

  if (!tab.id) {
    throw new Error("Failed to create tab");
  }

  const loaded = await waitForTabLoad(tab.id);
  if (!loaded) {
    throw new Error("Initial tab failed to load - LinkedIn may be down");
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
      type: "GET_COMPANY_ID",
    });

    if (result.companyId) {
      return { companyId: result.companyId };
    } else {
      return { error: "Could not find company information on profile page" };
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
      type: "GET_SCHOOL_ID",
    });

    if (result.schoolId) {
      return { schoolId: result.schoolId };
    } else {
      return { error: "Could not find school information on page" };
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
  employmentType: "current" | "past",
  maxPages: number = 10,
): Promise<{ connections: Connection[]; tabId: number }> {
  const connections: Connection[] = [];
  let currentTabId = tabId;
  let page = 1;

  logger.info(`Fetching ${employmentType.toUpperCase()} employees...`);

  while (page <= maxPages) {
    const url = LinkedInParser.buildConnectionsSearchUrl(
      personId,
      companyId,
      employmentType,
      page,
    );

    await browser.tabs.update(currentTabId, { url });
    const loaded = await waitForTabLoad(currentTabId);

    // If page didn't load, reset and retry
    if (!loaded) {
      logger.warn("Connection search page stuck, resetting tab...");
      currentTabId = await resetLinkedInTab(currentTabId);
      await browser.tabs.update(currentTabId, { url });
      await waitForTabLoad(currentTabId);
    }

    const parseResult = await sendToContentScript(currentTabId, {
      type: "PARSE_CONNECTIONS",
      payload: { employmentStatus: employmentType },
    });

    const pageConnections = parseResult.connections || [];

    logger.info(
      `Found ${pageConnections.length} ${employmentType} employees on page ${page}`,
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
  maxPages: number = 10,
): Promise<{ connections: Connection[]; tabId: number }> {
  const connections: Connection[] = [];
  let currentTabId = tabId;
  let page = 1;

  logger.info("Fetching school alumni...");

  while (page <= maxPages) {
    const url = LinkedInParser.buildSchoolConnectionsSearchUrl(
      personId,
      schoolId,
      page,
    );

    await browser.tabs.update(currentTabId, { url });
    const loaded = await waitForTabLoad(currentTabId);

    // If page didn't load, reset and retry
    if (!loaded) {
      logger.warn("Connection search page stuck, resetting tab...");
      currentTabId = await resetLinkedInTab(currentTabId);
      await browser.tabs.update(currentTabId, { url });
      await waitForTabLoad(currentTabId);
    }

    const parseResult = await sendToContentScript(currentTabId, {
      type: "PARSE_CONNECTIONS",
      payload: { employmentStatus: "alumni" },
    });

    const pageConnections = parseResult.connections || [];

    logger.info(`Found ${pageConnections.length} alumni on page ${page}`);

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
      type: "EXTRACT_PERSON_ID",
    });

    if (!personIdResult.personId) {
      return { error: "Could not extract person ID from profile page" };
    }

    const personId = personIdResult.personId;
    logger.info(`Extracted person ID: ${personId}`);

    const allConnections: Connection[] = [];

    if (args.company) {
      // Step 2a: Get current employees
      const currentResult = await fetchEmployeesByType(
        tabId,
        personId,
        args.id,
        "current",
      );
      allConnections.push(...currentResult.connections);
      tabId = currentResult.tabId;

      // Step 2b: Get past employees
      const pastResult = await fetchEmployeesByType(
        tabId,
        personId,
        args.id,
        "past",
      );
      allConnections.push(...pastResult.connections);
      tabId = pastResult.tabId;

      // Format response for company
      const currentConnections = allConnections.filter(
        (c) => c.employment_status === "current",
      );
      const pastConnections = allConnections.filter(
        (c) => c.employment_status === "past",
      );

      return {
        total: allConnections.length,
        currentEmployees: currentConnections.map((c) => ({
          name: c.name,
          profileLink: c.profile_link,
        })),
        pastEmployees: pastConnections.map((c) => ({
          name: c.name,
          profileLink: c.profile_link,
        })),
      };
    } else {
      // Step 2: Get school alumni
      const alumniResult = await fetchAlumniBySchool(tabId, personId, args.id);
      allConnections.push(...alumniResult.connections);

      // Format response for school
      return {
        total: allConnections.length,
        alumni: allConnections.map((c) => ({
          name: c.name,
          profileLink: c.profile_link,
        })),
      };
    }
  } catch (error) {
    return { error: String(error) };
  }
}

export async function browserCheckProductAvailability(args: {
  product_description: string;
  url: string;
}): Promise<string> {
  try {
    const config = await getConfig();
    const brightDataToken =
      config?.brightDataToken || import.meta.env.BRIGHT_DATA_TOKEN;

    if (!brightDataToken) {
      return "Bright Data token not configured";
    }

    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        "user-agent": "linkedin-scraper-ext/1.0.0",
        authorization: `Bearer ${brightDataToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: args.url,
        zone: "mcp_unlocker",
        format: "raw",
        data_format: "markdown",
      }),
    });

    if (!response.ok) {
      return `Scraping failed: ${response.status} ${response.statusText}`;
    }

    const markdown = await response.text();

    const apiKey = config?.azureApiKey || import.meta.env.AZURE_OPENAI_API_KEY;
    const endpoint = config?.azureEndpoint || import.meta.env.AZURE_ENDPOINT;
    const apiVersion =
      config?.azureApiVersion || import.meta.env.AZURE_API_VERSION;

    if (!apiKey || !endpoint || !apiVersion) {
      return "Azure OpenAI configuration incomplete";
    }

    const openai = new AzureOpenAI({
      apiKey: apiKey,
      endpoint: endpoint,
      apiVersion: apiVersion,
      dangerouslyAllowBrowser: true,
    });

    const instructions = `You are a product availability analyzer for e-commerce websites.

Your task is to analyze product page content and determine if a product is currently available for purchase.

# CRITICAL REQUIREMENTS - READ CAREFULLY

This MUST be a direct product page for ONE SPECIFIC PRODUCT SKU/MODEL that can be purchased with a single "Add to Cart" action.

# Two Types of Pages

## Type 1: Category/Listing Page (Multiple Products)
If the page shows multiple product models/variants listed separately:
- This is a CATEGORY/LISTING PAGE
- You MUST extract ALL individual product URLs from the page
- Return format: "LISTING_PAGE: [url1, url2, url3, ...]"

## Type 2: Single Product Page
If the page shows ONE specific product with ONE "Add to Cart" button:
- Check if it's in stock
- Return availability statement

# Analysis Criteria for Single Product Pages

ONLY mark as available if ALL of these are true:
1. The page is for ONE specific product model/SKU only
2. There is a single "Add to Cart", "Buy Now", or "Purchase" button for this specific product
3. Stock status shows "In Stock", "Available", or similar (NOT "Out of Stock")
4. This is NOT a listing/category page - it's the final product detail page

# Invalid Page Types

**THESE ARE CATEGORY/LISTING PAGES** - you must extract product URLs:
- Category pages showing multiple product models/brands
- Product listing pages (multiple products with individual links)
- Collection pages showing multiple options
- Any page showing multiple product cards/tiles with separate "Add to Cart" buttons

**EXAMPLE**: A page showing:
- Brand A Model X
- Brand B Model Y
- Brand C Model Z
This is a LISTING PAGE. Extract all product URLs.

# Valid Product Page

A valid page shows:
- ONE specific product only
- ONE price
- ONE "Add to Cart" button
- Specifications for this ONE product only

# Response Format

**For Category/Listing Pages:**
Start with "LISTING_PAGE:" followed by comma-separated product URLs.
Example: "LISTING_PAGE: https://example.com/product1, https://example.com/product2, https://example.com/product3"

**For Single Product Pages:**
Provide a clear statement about availability with evidence.

# Examples

**Category/Listing Page Response:**
"LISTING_PAGE: https://retailer.com/products/brand-a-model, https://retailer.com/products/brand-b-model, https://retailer.com/products/brand-c-model"

**Single Product - Available:**
"The product is available for purchase. The page displays an 'Add to Cart' button for this specific model and shows 'In Stock' status."

**Single Product - Unavailable:**
"The product is currently unavailable. The page shows 'Out of Stock' and the purchase button is disabled."

# CRITICAL
If you find multiple products on a page, you MUST return "LISTING_PAGE:" with all product URLs. Failing to extract product links is an absolute failure of this task.`;

    const userPrompt = `Product Description: ${args.product_description}
Page URL: ${args.url}

Page Content (markdown):
${markdown}

Is this product currently available for purchase?`;

    logger.debug(
      "Calling Azure OpenAI for product availability check with gpt-4.1...",
    );
    const apiResponse = await openai.responses.create({
      model: "gpt-4.1",
      instructions: instructions,
      input: [{ role: "user", content: userPrompt }],
      max_output_tokens: 2000,
    });

    logger.debug({ apiResponse }, "API Response");

    let resultText = "";
    if (apiResponse.output_text) {
      logger.debug({ output_text: apiResponse.output_text }, "Found output_text");
      resultText = apiResponse.output_text;
    } else if (apiResponse.output && Array.isArray(apiResponse.output)) {
      logger.debug({ length: apiResponse.output.length }, "Found output array with length");
      for (const item of apiResponse.output) {
        logger.debug({ item }, "Output item");
        if (item.type === "text" && item.content) {
          logger.debug({ content: item.content }, "Found text content");
          resultText = item.content;
          break;
        }
      }
    }

    if (!resultText) {
      logger.error("No result text found in API response");
      return "Unable to determine product availability - no response from API";
    }

    return resultText;
  } catch (error) {
    return `Error checking availability: ${String(error)}`;
  }
}

export async function browserGoogleSearch(args: {
  query: string;
}): Promise<any> {
  try {
    logger.info("browserGoogleSearch called with query:", args.query);

    const config = await getConfig();
    const brightDataToken =
      config?.brightDataToken || import.meta.env.BRIGHT_DATA_TOKEN;

    if (!brightDataToken) {
      return { error: "Bright Data token not configured" };
    }

    const encodedQuery = encodeURIComponent(args.query);
    const googleUrl = `https://www.google.com/search?q=${encodedQuery}&gl=uk`;

    logger.debug("Calling Bright Data unblocking service for Google search...");
    const response = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${brightDataToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: "mcp_unlocker",
        url: googleUrl,
        format: "raw",
        data_format: "parsed",
      }),
    });

    if (!response.ok) {
      return {
        error: `Bright Data API returned ${response.status} ${response.statusText}`,
      };
    }

    const responseText = await response.text();
    logger.debug(
      "Got raw response from Bright Data, length:",
      responseText.length,
    );

    try {
      const searchData = JSON.parse(responseText);

      const organicWithoutImages = (searchData.organic || []).map(
        (result: any) => {
          const { image, image_base64, ...rest } = result;
          return rest;
        },
      );

      const relatedWithoutImages = (searchData.related || []).map(
        (result: any) => {
          const { image, image_base64, ...rest } = result;
          return rest;
        },
      );

      return {
        organic: organicWithoutImages,
        pagination: searchData.pagination || {},
        related: relatedWithoutImages,
        ai_overview: searchData.ai_overview || null,
      };
    } catch (parseError) {
      logger.error({ error: parseError }, "Failed to parse search results");
      return {
        organic: [],
        pagination: {},
        related: [],
      };
    }
  } catch (error) {
    logger.error({ error }, "Error in browserGoogleSearch");
    return { error: `Error performing Google search: ${String(error)}` };
  }
}
