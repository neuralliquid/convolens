import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

export async function DELETE(request: Request) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const confirm =
      body !== null &&
      typeof body === "object" &&
      (body as Record<string, unknown>).confirm === "DELETE"
        ? "DELETE"
        : null;
    if (!confirm) {
      return Response.json(
        {
          error:
            'Confirmation required: send { "confirm": "DELETE" } to permanently delete this account',
        },
        { status: 400 },
      );
    }

    const token = await getConvolensApiToken();
    const response = await fetch(
      `${getConvolensApiBaseUrl()}/api/auth/account`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm }),
        cache: "no-store",
      },
    );
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
