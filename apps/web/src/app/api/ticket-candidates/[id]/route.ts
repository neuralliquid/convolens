import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getConvolensApiToken();
    const response = await fetch(
      `${getConvolensApiBaseUrl()}/api/ticket-candidates/${encodeURIComponent((await context.params).id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: await request.text(),
        cache: "no-store",
      },
    );
    return Response.json(await response.json(), { status: response.status });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
