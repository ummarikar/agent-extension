import { browser } from 'wxt/browser';

export interface Config {
  azureApiKey: string;
  azureEndpoint: string;
  azureApiVersion: string;
  azureDeployment: string;
  brightDataApiKey?: string;
  linkedinEmail?: string;
  linkedinPassword?: string;
}

const CONFIG_KEY = 'linkedin_scraper_config';

/**
 * Get configuration from storage
 */
export async function getConfig(): Promise<Config | null> {
  try {
    const result = await browser.storage.local.get(CONFIG_KEY);
    return result[CONFIG_KEY] || null;
  } catch (error) {
    console.error('Failed to get config:', error);
    return null;
  }
}

/**
 * Save configuration to storage
 */
export async function saveConfig(config: Config): Promise<void> {
  try {
    await browser.storage.local.set({ [CONFIG_KEY]: config });
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

/**
 * Clear configuration from storage
 */
export async function clearConfig(): Promise<void> {
  try {
    await browser.storage.local.remove(CONFIG_KEY);
  } catch (error) {
    console.error('Failed to clear config:', error);
    throw error;
  }
}
