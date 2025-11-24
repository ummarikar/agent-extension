import { useState, useRef, useEffect } from 'react';
import { browser } from 'wxt/browser';
import './Chat.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  type?: 'text' | 'tool_use' | 'tool_result' | 'error' | 'status';
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef('linkedin-scraper-persistent-session');
  const portRef = useRef<browser.runtime.Port | null>(null);
  const queryStartTimeRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load messages from storage on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const result = await browser.storage.local.get('chat_messages');
        if (result.chat_messages && Array.isArray(result.chat_messages)) {
          // Parse dates back from ISO strings
          const parsedMessages = result.chat_messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(parsedMessages);
        } else {
          // Start with empty messages
          setMessages([]);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, []);

  // Save messages to storage whenever they change
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      browser.storage.local.set({ chat_messages: messages }).catch((error) => {
        console.error('Error saving messages:', error);
      });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    // Establish port connection to background script
    const port = browser.runtime.connect({ name: `agent-${sessionIdRef.current}` });
    portRef.current = port;

    console.log('Connected to background script via port');

    // Listen for messages from background script
    port.onMessage.addListener((message: any) => {
      console.log('Received message from background:', message);

      if (
        message.type === 'AGENT_MESSAGE' &&
        message.sessionId === sessionIdRef.current
      ) {
        const { payload } = message;

        let messageType: 'text' | 'tool_use' | 'tool_result' | 'error' | 'status' = 'text';
        let sender: 'agent' | 'system' = 'agent';

        if (payload.type === 'tool_use' || payload.type === 'tool_result') {
          messageType = payload.type;
          sender = 'system';
        } else if (payload.type === 'error') {
          messageType = 'error';
          sender = 'system';
        } else if (payload.type === 'status') {
          messageType = 'status';
          sender = 'system';
        } else if (payload.type === 'complete') {
          setIsProcessing(false);
          // Calculate duration
          if (queryStartTimeRef.current) {
            const duration = ((Date.now() - queryStartTimeRef.current) / 1000).toFixed(2);
            console.log(`Task completed in ${duration}s`);
            const completionMessage: Message = {
              id: Date.now().toString() + Math.random(),
              text: `✓ Completed in ${duration}s`,
              sender: 'system',
              timestamp: new Date(),
              type: 'status',
            };
            setMessages((prev) => [...prev, completionMessage]);
            queryStartTimeRef.current = null;
          }
          return;
        }

        const newMessage: Message = {
          id: Date.now().toString() + Math.random(),
          text: typeof payload.content === 'object'
            ? JSON.stringify(payload.content, null, 2)
            : payload.content,
          sender,
          timestamp: new Date(),
          type: messageType,
        };

        setMessages((prev) => [...prev, newMessage]);

        if (payload.type === 'complete' || payload.type === 'error') {
          setIsProcessing(false);
        }
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('Disconnected from background script');
      portRef.current = null;
    });

    return () => {
      port.disconnect();
    };
  }, []);

  const handleSend = async () => {
    if (inputValue.trim() === '' || isProcessing) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    const promptToSend = inputValue;
    setInputValue('');
    setIsProcessing(true);

    // Record start time
    queryStartTimeRef.current = Date.now();

    // Send query to background script via port
    try {
      if (!portRef.current) {
        throw new Error('Not connected to background script');
      }

      portRef.current.postMessage({
        type: 'QUERY_AGENT',
        payload: {
          prompt: promptToSend,
          sessionId: sessionIdRef.current,
        },
      });
    } catch (error) {
      console.error('Error sending message to background:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: `Error: ${error}`,
          sender: 'system',
          timestamp: new Date(),
          type: 'error',
        },
      ]);
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = async () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
      await browser.storage.local.set({ chat_messages: [] });

      // Clear the session in the background script
      if (portRef.current) {
        portRef.current.postMessage({
          type: 'CLEAR_SESSION',
        });
      }
    }
  };

  const getMessageClassName = (message: Message) => {
    let className = 'message';

    if (message.sender === 'user') {
      className += ' user-message';
    } else if (message.sender === 'system') {
      className += ' system-message';
    } else {
      className += ' agent-message';
    }

    if (message.type === 'error') {
      className += ' error-message';
    } else if (message.type === 'tool_use') {
      className += ' tool-use-message';
    } else if (message.type === 'status') {
      className += ' status-message';
    }

    return className;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>LinkedIn Scraper Agent</h2>
        <button onClick={handleClearChat} className="clear-chat-button">
          Clear Chat
        </button>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={getMessageClassName(message)}>
            <div className="message-content">
              <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>
                {message.text}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            isProcessing ? 'Processing...' : 'Type your message...'
          }
          className="chat-input"
          disabled={isProcessing}
        />
        <button
          onClick={handleSend}
          className="send-button"
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

export default Chat;
