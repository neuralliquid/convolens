import { render, screen } from '../test-utils';
import { ChatContainer } from '../../apps/web/src/components/chat/ChatContainer';

// Mock the Message component to track its props
jest.mock('../../apps/web/src/components/chat/Message', () => ({
  Message: jest.fn(({ id, content, isConsecutive, showHeader, isFromMe, sender }) => {
    // Log the props for debugging
    console.log(`Message ${id} props:`, { 
      content, 
      isConsecutive, 
      showHeader, 
      isFromMe, 
      sender 
    });
    
    return (
      <div 
        data-testid={`message-${id}`}
        data-is-consecutive={String(isConsecutive)}
        data-show-header={String(showHeader)}
        data-is-from-me={String(isFromMe)}
        className={isFromMe ? 'items-end' : 'items-start'}
      >
        {showHeader && !isFromMe && (
          <div className="message-sender" data-testid={`sender-${id}`}>
            {sender}
          </div>
        )}
        <div className="message-content">
          {content}
        </div>
      </div>
    );
  })
}));
import { MessageProps } from '../../apps/web/src/components/chat/Message';

describe('ChatContainer Integration', () => {
  const currentUserId = 'user-1';
  
  const mockMessages = [
    {
      id: '1',
      sender: 'User 1',
      content: 'First message',
      timestamp: '2025-07-13T10:00:00Z',
      isFromMe: false,
    },
    {
      id: '2',
      sender: currentUserId,
      content: 'Second message',
      timestamp: '2025-07-13T10:01:00Z',
      isFromMe: true,
    },
    {
      id: '3',
      sender: currentUserId,
      content: 'Third message',
      timestamp: '2025-07-13T10:03:00Z',
      isFromMe: true,
    },
    {
      id: '4',
      sender: 'User 2',
      content: 'Fourth message',
      timestamp: '2025-07-14T09:00:00Z', // Next day
      isFromMe: false,
    },
  ];

  it('renders all messages', () => {
    render(<ChatContainer messages={mockMessages} currentUserId={currentUserId} />);
    
    mockMessages.forEach((message) => {
      expect(screen.getByText(message.content)).toBeInTheDocument();
    });
  });

  it('groups consecutive messages from the same sender', () => {
    // Import the formatChatMessages function directly
    const { formatChatMessages } = require('../../apps/web/src/utils/chatUtils');
    
    // Format the mock messages
    const formattedMessages = formatChatMessages(mockMessages);
    
    // Debug output
    console.log('Formatted messages:', JSON.stringify(formattedMessages, null, 2));
    
    // Define the message type for better type safety
    type FormattedMessage = {
      id: string;
      isConsecutive: boolean;
      showHeader: boolean;
      isFromMe: boolean;
      sender: string;
      content: string;
      timestamp: string;
      formattedTime: string;
    };
    
    // Find the messages in the formatted output
    const messages = {
      first: formattedMessages.find((msg: FormattedMessage) => msg.id === '1'),
      second: formattedMessages.find((msg: FormattedMessage) => msg.id === '2'),
      third: formattedMessages.find((msg: FormattedMessage) => msg.id === '3'),
      fourth: formattedMessages.find((msg: FormattedMessage) => msg.id === '4')
    };
    
    // Check that all messages were found
    if (!messages.first || !messages.second || !messages.third || !messages.fourth) {
      throw new Error('One or more test messages not found');
    }
    
    // Use basic JavaScript assertions to avoid pretty-format issues
    if (messages.first.isConsecutive !== false) {
      throw new Error('First message should not be consecutive (it\'s the first message)');
    }
    
    if (messages.second.isConsecutive !== false) {
      throw new Error('Second message should not be consecutive (different sender than first message)');
    }
    
    if (messages.third.isConsecutive !== true) {
      throw new Error('Third message should be consecutive (same sender as second message and within 5 minutes)');
    }
    
    if (messages.fourth.isConsecutive !== false) {
      throw new Error('Fourth message should not be consecutive (different day)');
    }
  });

  it('shows sender name for new message groups', () => {
    render(<ChatContainer messages={mockMessages} currentUserId={currentUserId} />);
    
    // First message from User 1 should show sender name
    expect(screen.getByTestId('sender-1')).toHaveTextContent('User 1');
    
    // First message from User 2 (after a day break) should show sender name
    expect(screen.getByTestId('sender-4')).toHaveTextContent('User 2');
  });

  it('displays messages in correct order', () => {
    render(<ChatContainer messages={mockMessages} currentUserId={currentUserId} />);
    
    const messages = screen.getAllByTestId(/^message-\d+$/);
    
    // Check that messages are in the correct order
    expect(messages[0]).toHaveTextContent('First message');
    expect(messages[1]).toHaveTextContent('Second message');
    expect(messages[2]).toHaveTextContent('Third message');
    expect(messages[3]).toHaveTextContent('Fourth message');
  });

  it('applies correct alignment based on message sender', () => {
    render(<ChatContainer messages={mockMessages} currentUserId={currentUserId} />);
    
    const messageElements = screen.getAllByTestId(/^message-\d+$/);
    
    // First message is from another user (left aligned)
    expect(messageElements[0]).toHaveClass('items-start');
    
    // Second and third messages are from current user (right aligned)
    expect(messageElements[1]).toHaveClass('items-end');
    expect(messageElements[2]).toHaveClass('items-end');
    
    // Fourth message is from another user (left aligned)
    expect(messageElements[3]).toHaveClass('items-start');
  });
});
