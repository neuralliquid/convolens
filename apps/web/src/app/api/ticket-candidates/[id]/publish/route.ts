import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensPublishTokens,
} from "@/lib/convolens-api";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { apiToken: token, batonToken } = await getConvolensPublishTokens();
    const response = await fetch(
      `${getConvolensApiBaseUrl()}/api/ticket-candidates/${encodeURIComponent((await context.params).id)}/publish`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Baton-Access-Token": batonToken,
        },
        cache: "no-store",
      },
    );
    return Response.json(await response.json(), { status: response.status });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
