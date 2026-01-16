import { Message } from '../../../apps/web/src/components/chat/Message';
import { render, screen } from '../../test-utils';

// The mock for @/lib/utils is now in __mocks__/@/lib/utils.ts

describe('Message Component', () => {
  const defaultProps = {
    id: '1',
    content: 'Hello, this is a test message',
    sender: 'Test User',
    timestamp: '2025-07-13T12:00:00Z',
    isFromMe: false,
  };

  it('renders message content correctly', () => {
    render(<Message {...defaultProps} />);
    expect(screen.getByText(defaultProps.content)).toBeInTheDocument();
  });

  it('shows sender name when not from me and showHeader is true', () => {
    render(<Message {...defaultProps} isFromMe={false} showHeader={true} />);
    expect(screen.getByText(defaultProps.sender)).toBeInTheDocument();
  });

  it('does not show sender name when isFromMe is true', () => {
    render(<Message {...defaultProps} isFromMe={true} showHeader={true} />);
    expect(screen.queryByText(defaultProps.sender)).not.toBeInTheDocument();
  });

  it('does not show sender name when isConsecutive is true', () => {
    render(<Message {...defaultProps} isConsecutive={true} showHeader={true} />);
    expect(screen.queryByText(defaultProps.sender)).not.toBeInTheDocument();
  });

  it('applies correct styling for messages from me', () => {
    render(<Message {...defaultProps} isFromMe={true} id="test-message" />);
    const messageElement = screen.getByTestId('message-test-message');
    expect(messageElement).toHaveAttribute('data-test-classes', 'items-end');
  });

  it('applies correct styling for messages from others', () => {
    render(<Message {...defaultProps} isFromMe={false} id="test-message" />);
    const messageElement = screen.getByTestId('message-test-message');
    expect(messageElement).toHaveAttribute('data-test-classes', 'items-start');
  });

  it('displays formatted time correctly', () => {
    render(<Message {...defaultProps} timestamp="2025-07-13T10:00:00Z" />);
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const customClass = 'custom-class';
    render(
      <Message {...defaultProps} className={customClass} id="test-message" />
    );
    const messageElement = screen.getByTestId('message-test-message');
    expect(messageElement.className).toContain(customClass);
  });
});
