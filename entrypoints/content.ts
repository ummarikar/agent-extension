import type { ExtensionMessage, ExtensionResponse } from '../types';
import { LinkedInParser, waitForSelector } from '../utils/linkedin';

export default defineContentScript({
  matches: ['*://*.linkedin.com/*'],

  main() {
    console.log('LinkedIn scraper content script loaded');

    // Listen for messages from background script
    browser.runtime.onMessage.addListener(
      (
        message: ExtensionMessage,
        sender,
        sendResponse
      ) => {
        console.log('Content script received message:', message);

        // Handle async operations
        (async () => {
          try {
            let response: ExtensionResponse;

            switch (message.type) {
              case 'LINKEDIN_LOGIN':
                response = await handleLogin(message.payload);
                break;

              case 'GET_COMPANY_ID':
                response = await handleGetCompanyId();
                break;

              case 'SCRAPE_HTML':
                response = {
                  success: true,
                  data: { html: document.documentElement.outerHTML },
                };
                break;

              case 'EXTRACT_PERSON_ID':
                response = await handleExtractPersonId();
                break;

              case 'PARSE_CONNECTIONS':
                response = handleParseConnections(message.payload);
                break;

              case 'GET_SCHOOL_ID':
                response = handleGetSchoolId();
                break;

              default:
                response = {
                  success: false,
                  error: `Unknown message type: ${message.type}`,
                };
            }

            sendResponse(response);
          } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();

        // Return true to indicate we'll send response asynchronously
        return true;
      }
    );
  },
});

async function handleLogin(credentials: {
  email: string;
  password: string;
}): Promise<ExtensionResponse> {
  try {
    // Check if we're on the login page
    if (!window.location.href.includes('linkedin.com')) {
      return {
        success: false,
        error: 'Not on LinkedIn login page',
      };
    }

    // Wait for login form
    const usernameInput = (await waitForSelector(
      'input#username',
      60000
    )) as HTMLInputElement;
    const passwordInput = (await waitForSelector(
      'input#password',
      60000
    )) as HTMLInputElement;

    // Fill in credentials
    usernameInput.value = credentials.email;
    passwordInput.value = credentials.password;

    // Dispatch input events to trigger React/Angular change detection
    usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Wait a bit for any animations/JS
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Click sign in button
    const submitButton = document.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;

    if (!submitButton) {
      return {
        success: false,
        error: 'Submit button not found',
      };
    }

    submitButton.click();

    // Wait for navigation
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check if login was successful
    const currentUrl = window.location.href;

    if (currentUrl.includes('feed') || currentUrl.includes('mynetwork')) {
      return {
        success: true,
        data: { message: 'Successfully logged in' },
      };
    } else if (
      currentUrl.includes('challenge') ||
      currentUrl.includes('checkpoint')
    ) {
      return {
        success: false,
        error: 'LinkedIn requires additional verification (CAPTCHA or 2FA)',
      };
    } else {
      return {
        success: false,
        error: 'Login may have failed or requires attention',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleGetCompanyId(): Promise<ExtensionResponse> {
  try {
    const html = document.documentElement.outerHTML;
    const companyId = LinkedInParser.extractCompanyId(html);

    if (companyId) {
      return {
        success: true,
        data: { companyId },
      };
    } else {
      return {
        success: false,
        error: 'Could not find company ID on page',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleExtractPersonId(): Promise<ExtensionResponse> {
  try {
    const html = document.documentElement.outerHTML;
    const personId = LinkedInParser.extractPersonId(html);

    if (personId) {
      return {
        success: true,
        data: { personId },
      };
    } else {
      return {
        success: false,
        error: 'Could not find person ID on page',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function handleParseConnections(payload: { employmentStatus: 'current' | 'past' }): ExtensionResponse {
  try {
    const { employmentStatus } = payload;

    // Use DOMParser to parse the current page
    const links = document.querySelectorAll('a[data-view-name="search-result-lockup-title"]');
    console.log(`Found ${links.length} links with search-result-lockup-title`);

    const connections: Array<{ name: string; profile_link: string; employment_status: string }> = [];

    links.forEach((link, index) => {
      const href = link.getAttribute('href');
      if (!href) {
        console.log(`Link ${index + 1}: No href, skipping`);
        return;
      }

      // Make absolute URL if needed
      let profileLink = href;
      if (!profileLink.startsWith('http')) {
        profileLink = `https://www.linkedin.com${profileLink}`;
      }

      // Get text content (automatically handles nested tags)
      const name = link.textContent?.trim() || '';

      console.log(`Link ${index + 1}:`, { name, profileLink });

      if (name && profileLink) {
        connections.push({
          name: name,
          profile_link: profileLink,
          employment_status: employmentStatus,
        });
      }
    });

    console.log(`Extracted ${connections.length} connections`);

    return {
      success: true,
      data: { connections },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function handleGetSchoolId(): ExtensionResponse {
  try {
    // Look for links with schoolFilter parameter
    const links = document.querySelectorAll('a[href*="schoolFilter"]');
    console.log(`Found ${links.length} links with schoolFilter`);

    for (const link of links) {
      const href = link.getAttribute('href');
      if (!href) continue;

      // Extract school ID from schoolFilter parameter
      // Pattern: schoolFilter=%5B%22{ID}%22%5D (encoded)
      const encodedMatch = href.match(/schoolFilter=%5B%22(\d+)%22%5D/i);
      if (encodedMatch && encodedMatch[1]) {
        console.log('Found school ID from encoded URL:', encodedMatch[1]);
        return {
          success: true,
          data: { schoolId: encodedMatch[1] },
        };
      }

      // Try unencoded version: schoolFilter=["ID"]
      const unencodedMatch = href.match(/schoolFilter=\["(\d+)"\]/i);
      if (unencodedMatch && unencodedMatch[1]) {
        console.log('Found school ID from unencoded URL:', unencodedMatch[1]);
        return {
          success: true,
          data: { schoolId: unencodedMatch[1] },
        };
      }
    }

    return {
      success: false,
      error: 'Could not find school ID on page',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
