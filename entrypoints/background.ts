import { AzureOpenAI } from "openai";
import { browser } from "wxt/browser";
import {
  WEB_SCRAPER_SYSTEM_PROMPT,
  linkedInTools,
  generalTools,
} from "../agents/web-scraper";
import { getConfig } from "../utils/config";
import { logger } from "../utils/logger";

// Store active ports for each session
const activePorts = new Map<string, browser.runtime.Port>();

// Store last response ID for each session to enable follow-up conversations
const sessionResponseIds = new Map<string, string>();

export default defineBackground({
  persistent: false,
  main() {
    logger.info({ id: browser.runtime.id }, "LinkedIn Scraper background script loaded");

    // Open side panel when extension icon is clicked
    browser.action.onClicked.addListener(async (tab) => {
      if (tab.id) {
        await browser.sidePanel.open({ tabId: tab.id });
      }
    });

    // Handle port connections from side panel
    browser.runtime.onConnect.addListener((port) => {
      logger.debug("Port connected:", port.name);

      if (port.name.startsWith("agent-")) {
        const sessionId = port.name.replace("agent-", "");
        activePorts.set(sessionId, port);

        port.onMessage.addListener((message) => {
          logger.debug("Received message on port:", message);

          if (message.type === "QUERY_AGENT") {
            handleAgentQuery(message.payload.prompt, sessionId);
          } else if (message.type === "CLEAR_SESSION") {
            // Clear the stored response ID for this session
            sessionResponseIds.delete(sessionId);
            logger.info(`Cleared session data for: ${sessionId}`);
          }
        });

        port.onDisconnect.addListener(() => {
          logger.debug("Port disconnected:", sessionId);
          activePorts.delete(sessionId);
        });
      }
    });

    // Listen for messages from popup (for config operations)
    browser.runtime.onMessage.addListener(
      async (message, sender, sendResponse) => {
        logger.debug("Background received message:", message);

        if (message.type === "SAVE_CONFIG") {
          try {
            await browser.storage.local.set({
              linkedin_scraper_config: message.payload,
            });
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: String(error) });
          }
          return true;
        }

        if (message.type === "GET_CONFIG") {
          try {
            const config = await getConfig();
            sendResponse({ success: true, data: config });
          } catch (error) {
            sendResponse({ success: false, error: String(error) });
          }
          return true;
        }
      },
    );
  },
});

async function handleAgentQuery(prompt: string, sessionId: string) {
  try {
    const config = await getConfig();

    // Get Azure config from config or fall back to environment variables
    const apiKey = config?.azureApiKey || import.meta.env.AZURE_OPENAI_API_KEY;
    const endpoint = config?.azureEndpoint || import.meta.env.AZURE_ENDPOINT;
    const apiVersion =
      config?.azureApiVersion || import.meta.env.AZURE_API_VERSION;
    const deployment =
      config?.azureDeployment || import.meta.env.LLM_AZURE_DEPLOYMENT;

    if (!apiKey || !endpoint || !apiVersion || !deployment) {
      sendMessageToPopup(sessionId, {
        type: "error",
        content:
          "Azure OpenAI configuration incomplete. Please add all required settings (API key, endpoint, API version, deployment).",
      });
      return;
    }

    // Send initial status
    sendMessageToPopup(sessionId, {
      type: "status",
      content: "Processing your request...",
    });

    // Initialize Azure OpenAI client
    const openai = new AzureOpenAI({
      apiKey: apiKey,
      endpoint: endpoint,
      apiVersion: apiVersion,
      dangerouslyAllowBrowser: true,
    });

    // Build tools array with MCP server and LinkedIn tools
    const brightDataToken = config?.brightDataToken || import.meta.env.BRIGHT_DATA_TOKEN;

    logger.info("Bright Data Token loaded:", brightDataToken ? "Yes (length: " + brightDataToken.length + ")" : "No");

    if (!brightDataToken) {
      sendMessageToPopup(sessionId, {
        type: "error",
        content: "Bright Data token not configured. Please add BRIGHT_DATA_TOKEN to your environment variables.",
      });
      return;
    }

    const tools = [
      {
        type: "mcp",
        server_label: "bright-data",
        server_description: "Bright Data MCP server for web scraping and LinkedIn data extraction",
        server_url: `https://mcp.brightdata.com/mcp?token=${brightDataToken}`,
        require_approval: "never",
      },
      ...linkedInTools.map((tool: any) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      })),
      ...generalTools.map((tool: any) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      })),
    ];

    // Create input list that we'll add to over time
    let input: any[] = [
      { role: "system", content: WEB_SCRAPER_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ];

    let maxIterations = 20; // Prevent infinite loops
    let iteration = 0;
    // Check if there's a previous response for this session to continue the conversation
    let previousResponseId: string | undefined = sessionResponseIds.get(sessionId);

    while (iteration < maxIterations) {
      iteration++;

      // Call the responses API with previous_response_id for multi-turn conversations
      const requestParams: any = {
        model: deployment,
        tools: tools as any,
        input,
        max_output_tokens: 4096,
      };

      if (previousResponseId) {
        requestParams.previous_response_id = previousResponseId;
      }

      const response = await openai.responses.create(requestParams);

      // Store the response ID for the next iteration
      if (response.id) {
        previousResponseId = response.id;
      }

      logger.debug({ response }, `Iteration ${iteration} response`);

      let hasToolCalls = false;
      let hasTextResponse = false;

      // Check if response has output_text (alternative format)
      if (response.output_text) {
        logger.debug({ output_text: response.output_text }, "Found output_text");
        sendMessageToPopup(sessionId, {
          type: "text",
          content: response.output_text,
        });
        hasTextResponse = true;
      }

      // Process the output array
      if (response.output && Array.isArray(response.output)) {
        logger.debug({ output: response.output }, "Processing output array");
        for (const item of response.output) {
          logger.debug({ item }, "Processing item");
          if (item.type === "text" && item.content) {
            hasTextResponse = true;
            logger.debug({ content: item.content }, "Sending text to popup");
            sendMessageToPopup(sessionId, {
              type: "text",
              content: item.content,
            });
          } else if (item.type === "function_call") {
            hasToolCalls = true;

            sendMessageToPopup(sessionId, {
              type: "tool_use",
              content: `Using tool: ${item.name}`,
            });

            // Find and execute the custom tool
            const allCustomTools = [...linkedInTools, ...generalTools];
            const customTool = allCustomTools.find(
              (t: any) => t.name === item.name
            );

            if (customTool) {
              try {
                const args = JSON.parse(item.arguments);
                const result = await customTool.run(args);

                sendMessageToPopup(sessionId, {
                  type: "tool_result",
                  content: result,
                });

                // Add function call output to input (stringify the result)
                input.push({
                  type: "function_call_output",
                  call_id: item.call_id,
                  output: typeof result === 'string' ? result : JSON.stringify(result),
                });
              } catch (error) {
                logger.error({ error }, "Error executing tool");
                const errorMsg = `Error executing ${item.name}: ${error}`;

                sendMessageToPopup(sessionId, {
                  type: "error",
                  content: errorMsg,
                });

                // Add error to input
                input.push({
                  type: "function_call_output",
                  call_id: item.call_id,
                  output: errorMsg,
                });
              }
            } else {
              // MCP tool or unknown tool - just log it
              logger.debug("MCP or unknown tool called:", item.name);
            }
          }
        }
      }

      // If no tool calls were made, we're done
      if (!hasToolCalls) {
        break;
      }
    }

    logger.info("Agent query completed after", iteration, "iterations");

    // Store the last response ID for this session to enable follow-up conversations
    if (previousResponseId) {
      sessionResponseIds.set(sessionId, previousResponseId);
    }

    // Send completion
    sendMessageToPopup(sessionId, {
      type: "complete",
      content: "Task completed",
    });
  } catch (error) {
    logger.error({ error }, "Error in agent query");
    sendMessageToPopup(sessionId, {
      type: "error",
      content: `Error: ${error}`,
    });
  }
}

function sendMessageToPopup(sessionId: string, message: any) {
  // Send message through the port
  const port = activePorts.get(sessionId);
  if (port) {
    try {
      port.postMessage({
        type: "AGENT_MESSAGE",
        sessionId,
        payload: message,
      });
    } catch (error) {
      logger.error({ error }, "Failed to send message to popup");
      activePorts.delete(sessionId);
    }
  } else {
    logger.warn("No active port for session:", sessionId);
  }
}
