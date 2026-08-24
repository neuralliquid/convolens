import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

export async function DELETE(request: Request) {
  try {
    const token = await getConvolensApiToken();
    const body = await request.json().catch(() => ({}));
    const response = await fetch(
      `${getConvolensApiBaseUrl()}/api/auth/account`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: body?.confirm }),
        cache: "no-store",
      },
    );
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
