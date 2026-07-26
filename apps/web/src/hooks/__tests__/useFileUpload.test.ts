import { act, renderHook } from "@testing-library/react";
import { useFileUpload } from "../useFileUpload";
import { toast } from "../../components/ui/toaster";

jest.mock("../../components/ui/toaster", () => ({
  toast: jest.fn(),
}));

const mockedToast = jest.mocked(toast);
const fetchMock = jest.fn<
  Promise<Partial<Response>>,
  [RequestInfo | URL, RequestInit?]
>();

describe("useFileUpload", () => {
  const update = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    mockedToast.mockReturnValue({
      id: "toast-1",
      dismiss: jest.fn(),
      update,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("posts an accepted text export and reports success", async () => {
    const onSuccess = jest.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { intakeId: "intake-1" } }),
    });
    const { result } = renderHook(() =>
      useFileUpload("/api/chat-export/upload", { onSuccess }),
    );

    let uploadResult;
    await act(async () => {
      uploadResult = await result.current.uploadFile(
        new File(["[26/07/2026, 10:00] Agent: Test"], "chat.txt", {
          type: "text/plain",
        }),
      );
    });

    expect(uploadResult).toEqual({
      success: true,
      data: { data: { intakeId: "intake-1" } },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat-export/upload",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(onSuccess).toHaveBeenCalledWith({ data: { intakeId: "intake-1" } });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Success", variant: "success" }),
    );
  });

  it("returns the API error so the dropzone can display it", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid WhatsApp export" }),
    });
    const { result } = renderHook(() =>
      useFileUpload("/api/chat-export/upload"),
    );

    let uploadResult;
    await act(async () => {
      uploadResult = await result.current.uploadFile(
        new File(["not an export"], "chat.txt", { type: "text/plain" }),
      );
    });

    expect(uploadResult).toEqual({
      success: false,
      error: "Invalid WhatsApp export",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Upload Failed",
        description: "Invalid WhatsApp export",
        variant: "destructive",
      }),
    );
  });
});
