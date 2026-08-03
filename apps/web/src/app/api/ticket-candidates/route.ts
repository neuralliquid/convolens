import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

export async function GET() {
  try {
    const token = await getConvolensApiToken();
    const response = await fetch(
      `${getConvolensApiBaseUrl()}/api/ticket-candidates`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    return Response.json(await response.json(), { status: response.status });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
