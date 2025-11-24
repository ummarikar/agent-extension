# Claude Code Agent Guidelines

## Project Type
Chrome extension built with WXT framework and TypeScript.

## Package Manager
**Always use `pnpm`** - never npm or yarn.

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run zip
```

## Main Files

### `entrypoints/background.ts`
Background service worker - handles agent execution and tool orchestration. Calls Azure OpenAI responses API and manages the tool execution loop.

### `agents/linkedin-scraper.ts`
Defines the AI agent's system prompt and available tools. Modify this to change agent behavior or add new tools.

### `utils/tools.ts`
Implements the actual tool functionality. Contains logic for LinkedIn navigation, tab management, and data extraction.

### `entrypoints/content.ts`
Content script injected into LinkedIn pages. Handles DOM parsing and data extraction from LinkedIn's HTML.

### `entrypoints/sidepanel/Chat.tsx`
React UI component for the chat interface. Main user interaction point.

### `wxt.config.ts`
Extension configuration - manifest permissions and environment variable injection.

### `types/index.ts`
TypeScript type definitions for messages, connections, and data structures.

## Environment Variables

Add secrets to `.env.development.local` and `.env.production.local`:
```env
AZURE_OPENAI_API_KEY=...
AZURE_ENDPOINT=...
AZURE_API_VERSION=...
LLM_AZURE_DEPLOYMENT=...
BRIGHT_DATA_TOKEN=...
```

These files are gitignored. Variables must also be added to `wxt.config.ts` vite define section to be available at runtime.

## Code Style

### No Comments
**Do not add comments unless absolutely necessary.** Code should be self-documenting through clear naming and structure. Only comment when logic is unavoidably complex or explaining non-obvious workarounds.

### README Updates
**Update README.md after making significant changes** - especially when adding features, modifying architecture, or changing how the extension works.

## Development

Load unpacked extension from `.output/chrome-mv3` folder after running:
```bash
pnpm run dev  # Development with hot reload
pnpm run build  # Production build
```
