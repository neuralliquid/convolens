import { render } from '@testing-library/react';
import { ChatContainer } from 'apps/web/src/components/chat/ChatContainer';
import { measurePerformance } from 'reassure';

// Generate a large number of test messages
const generateTestMessages = (count: number) => {
  const messages = [];
  let timestamp = Date.now() - count * 60000; // Spread messages over time
  
  for (let i = 0; i < count; i++) {
    // NOSONAR: Math.random() is safe here - only used for generating test data, not for security purposes
    const isFromMe = Math.random() > 0.5;
    messages.push({
      id: `msg-${i}`,
      sender: isFromMe ? 'current-user' : `user-${Math.floor(Math.random() * 5) + 1}`, // NOSONAR: test data only
      content: `This is test message #${i + 1}. `.repeat(Math.floor(Math.random() * 5) + 1).trim(), // NOSONAR: test data only
      timestamp: new Date(timestamp).toISOString(),
      isFromMe,
    });
    timestamp += 60000; // 1 minute between messages
  }
  
  return messages;
};

describe('Chat Performance', () => {
  it('should render 50 messages efficiently', async () => {
    const testMessages = generateTestMessages(50);
    
    await measurePerformance(
      <ChatContainer messages={testMessages} currentUserId="current-user" />
    );
  });

  it('should render 200 messages efficiently', async () => {
    const testMessages = generateTestMessages(200);
    
    await measurePerformance(
      <ChatContainer messages={testMessages} currentUserId="current-user" />,
      { timeout: 10000 } // Give it more time for larger datasets
    );
  });

  it('should handle rapid updates efficiently', async () => {
    const initialMessages = generateTestMessages(50);
    const additionalMessages = generateTestMessages(10);
    
    const { rerender } = render(
      <ChatContainer messages={initialMessages} currentUserId="current-user" />
    );
    
    // Measure time to add 10 more messages
    await measurePerformance(
      () => {
        rerender(
          <ChatContainer 
            messages={[...initialMessages, ...additionalMessages]} 
            currentUserId="current-user" 
          />
        );
      },
      { 
        runs: 5, // Run multiple times to get more stable metrics
        warmup: 2, // Warmup runs before measuring
      }
    );
  });
});
