import { useState } from 'react';
import Chat from './Chat';
import Settings from './Settings';
import './App.css';

type Tab = 'chat' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  return (
    <div className="app-container">
      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </div>
  );
}

export default App;
