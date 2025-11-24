import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import './Settings.css';

interface Config {
  anthropicApiKey: string;
  brightDataApiKey?: string;
  linkedinEmail?: string;
  linkedinPassword?: string;
}

function Settings() {
  const [config, setConfig] = useState<Config>({
    anthropicApiKey: '',
    brightDataApiKey: '',
    linkedinEmail: '',
    linkedinPassword: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Load existing config
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_CONFIG',
      });

      if (response.success && response.data) {
        setConfig({
          anthropicApiKey: response.data.anthropicApiKey || '',
          brightDataApiKey: response.data.brightDataApiKey || '',
          linkedinEmail: response.data.linkedinEmail || '',
          linkedinPassword: response.data.linkedinPassword || '',
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSave = async () => {
    if (!config.anthropicApiKey.trim()) {
      setSaveMessage('Anthropic API key is required');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const response = await browser.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        payload: config,
      });

      if (response.success) {
        setSaveMessage('Settings saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage(`Error: ${response.error}`);
      }
    } catch (error) {
      setSaveMessage(`Error: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-container">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3>API Configuration</h3>

        <div className="form-group">
          <label htmlFor="anthropicApiKey">
            Anthropic API Key <span className="required">*</span>
          </label>
          <input
            id="anthropicApiKey"
            type="password"
            value={config.anthropicApiKey}
            onChange={(e) =>
              setConfig({ ...config, anthropicApiKey: e.target.value })
            }
            placeholder="sk-ant-..."
            className="settings-input"
          />
          <small className="input-hint">
            Required for Claude AI agent. Get it from{' '}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              console.anthropic.com
            </a>
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="brightDataApiKey">Bright Data API Key</label>
          <input
            id="brightDataApiKey"
            type="password"
            value={config.brightDataApiKey || ''}
            onChange={(e) =>
              setConfig({ ...config, brightDataApiKey: e.target.value })
            }
            placeholder="Optional"
            className="settings-input"
          />
          <small className="input-hint">
            Optional. For enhanced scraping capabilities.
          </small>
        </div>
      </div>

      <div className="settings-section">
        <h3>LinkedIn Credentials</h3>

        <div className="form-group">
          <label htmlFor="linkedinEmail">LinkedIn Email</label>
          <input
            id="linkedinEmail"
            type="email"
            value={config.linkedinEmail || ''}
            onChange={(e) =>
              setConfig({ ...config, linkedinEmail: e.target.value })
            }
            placeholder="your@email.com"
            className="settings-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="linkedinPassword">LinkedIn Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="linkedinPassword"
              type={showPassword ? 'text' : 'password'}
              value={config.linkedinPassword || ''}
              onChange={(e) =>
                setConfig({ ...config, linkedinPassword: e.target.value })
              }
              placeholder="Password"
              className="settings-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="toggle-password-button"
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <small className="input-hint">
            Optional. Stored locally for automatic login.
          </small>
        </div>
      </div>

      {saveMessage && (
        <div
          className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}
        >
          {saveMessage}
        </div>
      )}

      <button
        onClick={handleSave}
        className="save-button"
        disabled={isSaving}
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>

      <div className="info-section">
        <h3>How to Use</h3>
        <ol>
          <li>Add your Anthropic API key (required)</li>
          <li>Optionally add LinkedIn credentials for auto-login</li>
          <li>
            Go to the Chat tab and ask the agent to find employees, e.g.:
            "Get all employees that work at Convergence AI"
          </li>
          <li>The agent will guide you through the process</li>
        </ol>
      </div>
    </div>
  );
}

export default Settings;
