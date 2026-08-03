import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

async function proxySummary(id: string, init?: RequestInit) {
  const token = await getConvolensApiToken();
  const response = await fetch(
    `${getConvolensApiBaseUrl()}/api/chat-export/${encodeURIComponent(id)}/summary`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    },
  );
  const payload = await response.json();
  return Response.json(payload, { status: response.status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await proxySummary((await params).id);
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await request.text();
    return await proxySummary((await params).id, { method: "POST", body });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
