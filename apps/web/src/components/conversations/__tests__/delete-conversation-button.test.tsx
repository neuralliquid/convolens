import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteConversationButton } from "../delete-conversation-button";

describe("DeleteConversationButton", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it("requires confirmation before deleting", () => {
    jest.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <DeleteConversationButton
        conversationId="conversation-1"
        onDeleted={jest.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("deletes through the user-scoped route and reports success", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Conversation deleted" }),
    });
    const onDeleted = jest.fn();

    render(
      <DeleteConversationButton
        conversationId="conversation/1"
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat-export/conversation%2F1",
      { method: "DELETE" },
    );
  });

  it("keeps the conversation visible and shows an API error", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Conversation not found" }),
    });
    const onDeleted = jest.fn();

    render(
      <DeleteConversationButton
        conversationId="missing"
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete conversation" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Conversation not found",
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
