import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VoiceNoteTranscriptionPanel } from "../voice-note-transcription-panel";

const message = {
  id: "message/1",
  senderName: "Hans",
  content: "<attached: voice-note.opus>",
  sentAt: "2026-08-21T00:00:00.000Z",
};

describe("VoiceNoteTranscriptionPanel", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it("shows the processing path and requires both a file and explicit consent", () => {
    render(
      <VoiceNoteTranscriptionPanel
        conversationId="conversation-1"
        messages={[message]}
        onTranscribed={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/ConvoLens → xtox → Sluice → Azure AI Foundry/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Transcribe voice note" }),
    ).toBeDisabled();
  });

  it("submits the selected audio only after consent and reports the transcript", async () => {
    const transcript = {
      id: "transcript-1",
      text: "Synthetic transcript.",
      language: "en",
      durationMs: 1250,
      generatedAt: "2026-08-21T01:00:00.000Z",
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { transcript } }),
    });
    const onTranscribed = jest.fn();
    render(
      <VoiceNoteTranscriptionPanel
        conversationId="conversation/1"
        messages={[message]}
        onTranscribed={onTranscribed}
      />,
    );

    fireEvent.change(screen.getByLabelText("Exported voice-note file"), {
      target: {
        files: [new File(["audio"], "voice.opus", { type: "audio/ogg" })],
      },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I consent to sending this audio/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Transcribe voice note" }),
    );

    await waitFor(() =>
      expect(onTranscribed).toHaveBeenCalledWith("message/1", transcript),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat-export/conversation%2F1/messages/message%2F1/transcript",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData;
    expect(body.get("modelProcessingConsent")).toBe("true");
    expect((body.get("file") as File).name).toBe("voice.opus");
  });

  it("shows a stored transcript without asking for the audio again", () => {
    render(
      <VoiceNoteTranscriptionPanel
        conversationId="conversation-1"
        messages={[
          {
            ...message,
            transcript: {
              id: "transcript-1",
              text: "Already transcribed.",
              generatedAt: "2026-08-21T01:00:00.000Z",
            },
          },
        ]}
        onTranscribed={jest.fn()}
      />,
    );

    expect(screen.getByText("Already transcribed.")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Exported voice-note file"),
    ).not.toBeInTheDocument();
  });
});
