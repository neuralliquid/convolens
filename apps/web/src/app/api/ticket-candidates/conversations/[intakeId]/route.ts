import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

async function proxy(intakeId: string, method: "GET" | "POST") {
  const token = await getConvolensApiToken();
  const suffix = method === "POST" ? "/generate" : "";
  const response = await fetch(
    `${getConvolensApiBaseUrl()}/api/ticket-candidates/conversations/${encodeURIComponent(intakeId)}${suffix}`,
    {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  return Response.json(await response.json(), { status: response.status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ intakeId: string }> },
) {
  try {
    return await proxy((await context.params).intakeId, "GET");
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ intakeId: string }> },
) {
  try {
    return await proxy((await context.params).intakeId, "POST");
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
