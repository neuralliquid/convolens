import { render, screen } from "@testing-library/react";
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
              projectId: "project-1",
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
      screen.getByRole("button", { name: "Publish to Baton" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Save edits" }),
    ).not.toBeInTheDocument();
  });
});
