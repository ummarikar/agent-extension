# Web Scraper Agent

An AI-powered Chrome extension for general web scraping and data extraction, with specialized capabilities for LinkedIn profile discovery. Built using Azure OpenAI and Bright Data MCP server.

## Overview

This browser extension provides an intelligent agent that can scrape any website and extract structured data. It uses Azure OpenAI's responses API with tool calling to orchestrate web scraping, navigation, and data extraction. The agent includes specialized tools for LinkedIn tasks such as discovering company employees and school alumni.

## Features

- **General Web Scraping**: Extract data from any website using Bright Data MCP tools
- **LinkedIn Specialization**:
  - Discover company employees (current and past)
  - Find school/university alumni
  - Extract profile information
  - Automated LinkedIn navigation
- **Conversation Memory**: Maintains context across multiple queries in the same session
- **Multi-turn Tool Execution**: Iteratively calls tools until task completion
- **MCP Server Integration**: Uses Bright Data MCP server for advanced web scraping
- **Side Panel UI**: Persistent chat interface that stays open across tabs

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd linkedin-scraper-ext
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   Create `.env.development.local` and `.env.production.local` files with:

   ```env
   AZURE_OPENAI_API_KEY=your_azure_openai_api_key
   AZURE_API_VERSION=2025-03-01-preview
   AZURE_ENDPOINT=https://your-resource.openai.azure.com/
   LLM_AZURE_DEPLOYMENT=your_deployment_name
   BRIGHT_DATA_TOKEN=your_bright_data_token
   ```

4. **Build the extension**

   ```bash
   pnpm run build
   ```

5. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3` folder

## Usage

1. Click the extension icon in Chrome toolbar to open the side panel
2. Type your query, for example:
   - **General scraping**: "Scrape product prices from example-store.com"
   - **LinkedIn employees**: "Get me all the employees of Anthropic"
   - **LinkedIn alumni**: "Find alumni from Stanford University"
   - **Web data extraction**: "Extract all blog post titles from example-blog.com"
3. The agent will autonomously use appropriate tools to complete your request
4. Results are displayed in the chat with relevant links and structured data
5. You can ask follow-up questions in the same session

## Project Structure

### Core Files

#### `wxt.config.ts`

Configuration file for the WXT extension framework.

- **Purpose**: Defines manifest permissions, environment variables, and build settings
- **Key sections**:
  - `manifest`: Chrome extension permissions and side panel configuration
  - `vite.define`: Injects environment variables into the build
- **When to modify**: When adding new permissions or environment variables

#### `entrypoints/background.ts`

Service worker that runs in the background and handles agent execution.

- **Purpose**: Main orchestration layer - receives queries, calls Azure OpenAI, executes tools
- **Key functions**:
  - `handleAgentQuery()`: Processes user queries through Azure OpenAI responses API
  - `sendMessageToSidePanel()`: Sends updates to the UI via port connections
- **Agent loop**: Iterates up to 20 times, executing tools until completion
- **When to modify**:
  - To change AI model configuration
  - To add/remove tools from the agent
  - To modify tool execution logic
  - To change max iterations or token limits

#### `agents/web-scraper.ts`

Defines the AI agent's behavior, system prompt, and available tools.

- **Purpose**: Contains agent instructions and tool definitions
- **Key exports**:
  - `WEB_SCRAPER_SYSTEM_PROMPT`: Instructions that guide the agent's behavior for general web scraping and LinkedIn-specific tasks
  - `linkedInTools`: Array of LinkedIn-specific custom tools (get_company_id, get_school_id, get_connections)
- **When to modify**:
  - **To change agent behavior**: Edit the system prompt to change how it approaches tasks
  - **To add new tools**: Define new tool objects and add to appropriate tools array
  - **To change tool parameters**: Modify `inputSchema` for existing tools

#### `utils/tools.ts`

Implements the actual functionality behind each agent tool.

- **Purpose**: Contains the logic that executes when the agent calls a tool
- **Key functions**:
  - `getCompanyIdFromProfile()`: Extracts company ID from LinkedIn profile pages
  - `getSchoolIdFromPage()`: Extracts school ID from LinkedIn school pages
  - `getConnections()`: Scrapes connections for a person, filtered by company/school
  - `getLinkedInTab()`: Manages tab creation and navigation with auto-reset for stuck pages
- **When to modify**:
  - To change how tools interact with LinkedIn
  - To add new scraping capabilities
  - To modify tab management and error handling

#### `entrypoints/content.ts`

Content script injected into LinkedIn pages for DOM manipulation and parsing.

- **Purpose**: Runs in the context of LinkedIn pages to extract data from the DOM
- **Key functions**:
  - `handleGetCompanyId()`: Extracts company ID from page HTML
  - `handleGetSchoolId()`: Extracts school ID from page HTML
  - `handleExtractPersonId()`: Extracts person ID from profile pages
  - `handleParseConnections()`: Parses connection list from search results
- **When to modify**:
  - When LinkedIn's HTML structure changes
  - To extract different data from pages
  - To add new DOM parsing capabilities

#### `entrypoints/sidepanel/Chat.tsx`

React component for the chat interface.

- **Purpose**: Main UI component that users interact with
- **Key features**:
  - Message display with different types (user, agent, system, error)
  - Port-based communication with background script
  - Message persistence using browser storage
  - Timer display for task completion
- **When to modify UI**:
  - Edit JSX in the `return` statement to change layout
  - Modify `Chat.css` to change styling
  - Update `getMessageClassName()` to change message appearance
  - Edit message handling logic to change how responses are displayed

#### `entrypoints/sidepanel/App.tsx`

Root React component for the side panel.

- **Purpose**: Top-level component that renders the chat interface
- **When to modify**: To add new UI sections or components around the chat

#### `utils/linkedin.ts`

LinkedIn-specific parsing utilities.

- **Purpose**: Contains regex patterns and parsing logic for LinkedIn data
- **Key exports**:
  - `LinkedInParser.extractCompanyId()`: Regex-based company ID extraction
  - `LinkedInParser.extractSchoolId()`: Regex-based school ID extraction
  - `LinkedInParser.extractPersonId()`: Regex-based person ID extraction
  - URL builders for connection search pages
- **When to modify**: When LinkedIn's URL structure or page patterns change

#### `types/index.ts`

TypeScript type definitions.

- **Purpose**: Ensures type safety across the codebase
- **Key types**:
  - `Connection`: Structure for scraped LinkedIn profiles
  - `MessageType`: Valid message types between scripts
  - `ExtensionMessage`: Message format for inter-script communication
- **When to modify**: When adding new message types or data structures

### CSS Files

#### `entrypoints/sidepanel/Chat.css`

Styles for the chat interface.

- **When to modify UI**:
  - Change colors, fonts, spacing
  - Modify message bubble appearance
  - Adjust input and button styles
  - Update animations and transitions

#### `entrypoints/sidepanel/App.css`

Global styles for the side panel.

- **When to modify**: To change overall layout or viewport behavior

## Making Changes

### Updating the UI

1. **Change Layout/Structure**:

   - Edit `entrypoints/sidepanel/Chat.tsx`
   - Modify the JSX in the `return` statement

2. **Change Styling**:

   - Edit `entrypoints/sidepanel/Chat.css` for chat-specific styles
   - Edit `entrypoints/sidepanel/App.css` for global styles

3. **Add New UI Components**:

   - Create new `.tsx` files in `entrypoints/sidepanel/`
   - Import and use in `Chat.tsx` or `App.tsx`

4. **Change Message Display**:
   - Modify `getMessageClassName()` in `Chat.tsx` to change message types
   - Update message rendering in the JSX map function
   - Add new CSS classes in `Chat.css`

### Modifying the Agent

1. **Change Agent Behavior**:

   - Edit `WEB_SCRAPER_SYSTEM_PROMPT` in `agents/web-scraper.ts`
   - Modify general instructions for broader capabilities
   - Update LinkedIn-specific workflow if needed
   - Add new rules or constraints

2. **Add New Tools**:

   - Define tool object in `agents/web-scraper.ts` with:
     - `name`: Tool identifier
     - `description`: What the tool does
     - `inputSchema`: JSON schema for parameters
     - `run`: Async function that executes the tool
   - Implement tool logic in `utils/tools.ts`
   - Add to `linkedInTools` array (for LinkedIn tools) or create new tools array (for other tools)
   - Export and import the tools array in `entrypoints/background.ts`

3. **Modify Existing Tools**:

   - Change `inputSchema` in `agents/web-scraper.ts` to update parameters
   - Update implementation in `utils/tools.ts`
   - Adjust content script handlers in `entrypoints/content.ts` if needed

4. **Change Model Configuration**:

   - Edit `handleAgentQuery()` in `entrypoints/background.ts`
   - Modify `max_output_tokens`, iteration limits, or model parameters
   - Update environment variables for different Azure deployments

5. **Add MCP Tools**:
   - MCP tools are automatically available via the Bright Data server
   - Reference them in the system prompt (e.g., `mcp__brightdata__web_data_linkedin_person_profile`)
   - No code changes needed - just update the prompt

## Development

```bash
# Run in development mode with hot reload
pnpm run dev

# Build for production
pnpm run build

# Create distributable zip
pnpm run zip
```

## Architecture

```
┌─────────────────┐
│   Side Panel    │  User interacts with chat UI
│   (Chat.tsx)    │  Sends queries via port connection
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Background     │  Orchestrates agent execution
│  Service Worker │  Calls Azure OpenAI responses API
└────────┬────────┘  Executes tools in loop
         │
         ├──────────────────┐
         ▼                  ▼
┌─────────────────┐  ┌─────────────────┐
│  Custom Tools   │  │  MCP Server     │
│  (utils/tools)  │  │  (Bright Data)  │
└────────┬────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Content Script │  DOM parsing and manipulation
│  (content.ts)   │  Runs in LinkedIn page context
└─────────────────┘
```

## How It Works

1. **User sends query** in the side panel chat interface
2. **Background script** receives query via port connection
3. **Azure OpenAI** processes query with system prompt and available tools
4. **Agent decides** which tools to call (MCP tools or custom tools)
5. **Tools execute**:
   - Custom tools use browser APIs to navigate and extract data
   - Content script parses LinkedIn DOM
   - MCP server handles advanced web scraping
6. **Results return** to Azure OpenAI for next step
7. **Loop continues** until task is complete (max 20 iterations)
8. **Final response** displayed to user with timing information

## Troubleshooting

- **"Not connected to background script"**: Reload the extension
- **LinkedIn pages stuck loading**: The extension auto-resets tabs after 30 seconds
- **Configuration errors**: Verify all environment variables are set correctly
- **MCP tool errors**: Check Bright Data token is valid
- **Build errors**: Delete `.wxt` and `node_modules`, then reinstall dependencies

## License

See LICENSE file for details.
