import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getConvolensApiToken();
    const { id } = await params;
    const response = await fetch(
      `${getConvolensApiBaseUrl()}/api/chat-export/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
