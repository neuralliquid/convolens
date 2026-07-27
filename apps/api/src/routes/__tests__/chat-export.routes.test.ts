import { getLegacyParticipantLabels, isValidExtensionChatData } from '../chat-export.routes.js';

const v1Payload = {
  chatName: 'Team chat',
  chatId: 'chat_123',
  extractedAt: '2026-07-27T10:00:00.000Z',
  messageCount: 1,
  messages: [
    {
      id: 'message_1',
      text: 'Hello',
      sender: 'Sarah',
      timestamp: '2026-07-27T10:00:00.000Z',
      isOutgoing: false,
      isMedia: false,
    },
  ],
  source: 'chrome-extension' as const,
  version: '1.0.6',
  isGroup: true,
};

describe('extension chat payload validation', () => {
  it('keeps v1 extension payloads compatible', () => {
    expect(isValidExtensionChatData(v1Payload)).toBe(true);
  });

  it('accepts v2 participant observations with message references', () => {
    expect(
      isValidExtensionChatData({
        ...v1Payload,
        version: '1.0.7',
        payloadVersion: 2,
        participants: [
          {
            ref: 'participant_1',
            rawDisplayName: 'Sarah Mokoena',
            normalizedPhone: '+27821234567',
            isSelf: false,
            extractionMethod: 'metadata',
            confidence: 'high',
          },
        ],
        messages: [{ ...v1Payload.messages[0], senderRef: 'participant_1' }],
      })
    ).toBe(true);
  });

  it('accepts aggregate-only extraction diagnostics', () => {
    expect(
      isValidExtensionChatData({
        ...v1Payload,
        payloadVersion: 2,
        participants: [],
        diagnostics: {
          messageContainerCount: 20,
          extractedMessageCount: 20,
          metadataPathCounts: { container: 0, ancestor: 0, descendant: 0, none: 20 },
          senderMethodCounts: {
            metadata: 0,
            'sender-element': 0,
            'conversation-header': 0,
            outgoing: 0,
            fallback: 20,
          },
          timestampMethodCounts: { metadata: 0, 'visible-time': 0, fallback: 20 },
        },
      })
    ).toBe(true);
  });

  it('rejects a v2 sender reference that has no participant observation', () => {
    expect(
      isValidExtensionChatData({
        ...v1Payload,
        payloadVersion: 2,
        participants: [],
        messages: [{ ...v1Payload.messages[0], senderRef: 'participant_missing' }],
      })
    ).toBe(false);
  });

  it('retains a numbered fallback participant in the legacy list', () => {
    const payload = {
      ...v1Payload,
      payloadVersion: 2 as const,
      participants: [
        {
          ref: 'participant_1',
          isSelf: false,
          extractionMethod: 'fallback',
          confidence: 'low',
        },
      ],
      messages: [
        {
          ...v1Payload.messages[0],
          sender: 'Unidentified participant 1',
          senderRef: 'participant_1',
        },
      ],
    };

    expect(getLegacyParticipantLabels(payload)).toEqual(['Unidentified participant 1']);
  });
});
