import { fireEvent, render, screen } from "@testing-library/react";
import { TicketCandidateReview } from "../ticket-candidate-review";

describe("TicketCandidateReview", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candidates: [
            {
              id: "candidate-1",
              title: "Accepted title",
              description: "Accepted description",
              confidence: "high",
              projectId: "11111111-1111-4111-8111-111111111111",
              status: "accepted",
              revision: 2,
              publishStatus: "not_requested",
              evidence: [
                {
                  position: 0,
                  senderName: "Operator",
                  sentAt: "2026-07-31T10:00:00.000Z",
                },
              ],
            },
          ],
        },
      }),
    });
  });

  it("renders accepted candidate fields read-only before publish", async () => {
    render(<TicketCandidateReview intakeId="intake-1" />);

    expect(await screen.findByLabelText("Candidate title")).toBeDisabled();
    expect(screen.getByLabelText("Candidate description")).toBeDisabled();
    expect(screen.getByLabelText("Baton project ID")).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Publish confirmed draft to Baton",
      }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Save edits" }),
    ).not.toBeInTheDocument();
  });

  it("requires pending edits to be saved before acceptance", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candidates: [
            {
              id: "candidate-2",
              title: "Pending title",
              description: "Pending description",
              confidence: "high",
              projectId: "11111111-1111-4111-8111-111111111111",
              status: "pending",
              revision: 1,
              publishStatus: "not_requested",
              evidence: [
                {
                  position: 0,
                  senderName: "Operator",
                  sentAt: "2026-07-31T10:00:00.000Z",
                },
              ],
            },
          ],
        },
      }),
    });
    render(<TicketCandidateReview intakeId="intake-1" />);
    const accept = await screen.findByRole("button", {
      name: "Confirm for Baton",
    });
    expect(accept).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Candidate title"), {
      target: { value: "Unsaved reviewed title" },
    });

    expect(accept).toBeDisabled();
    expect(screen.getByText("Save edits before accepting.")).toBeVisible();
  });

  it("shows exact catch-up and evidence links in the personal list", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          candidates: [
            {
              id: "candidate-3",
              title: "Verify evidence",
              confidence: "high",
              projectId: "11111111-1111-4111-8111-111111111111",
              status: "pending",
              revision: 1,
              publishStatus: "not_requested",
              evidence: [
                {
                  messageId: "message-42",
                  position: 41,
                  senderName: "Operator",
                  sentAt: "2026-08-03T10:00:00.000Z",
                },
              ],
              sourceContext: {
                conversationId: "intake-1",
                conversationName: "Delivery chat",
                catchUpHref: "/dashboard/conversations/intake-1#catch-up",
                evidenceLinks: [
                  {
                    messageId: "message-42",
                    href: "/dashboard/conversations/intake-1#message-message-42",
                  },
                ],
              },
            },
          ],
        },
      }),
    });

    render(<TicketCandidateReview />);

    expect(await screen.findByText("Catch-up: Delivery chat")).toHaveAttribute(
      "href",
      "/dashboard/conversations/intake-1#catch-up",
    );
    expect(screen.getByText("Message 42")).toHaveAttribute(
      "href",
      "/dashboard/conversations/intake-1#message-message-42",
    );
    expect(
      screen.queryByRole("button", { name: "Find explicit actions" }),
    ).not.toBeInTheDocument();
  });
});
