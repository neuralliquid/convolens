import { NextResponse } from "next/server";
import {
  apiAuthErrorResponse,
  getConvolensApiBaseUrl,
  getConvolensApiToken,
} from "@/lib/convolens-api";

export const maxDuration = 60; // 1 minute timeout

export async function POST(request: Request) {
  try {
    const apiToken = await getConvolensApiToken();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Forward the file to the backend service
    const backendUrl = `${getConvolensApiBaseUrl()}/api/chat-export/upload`;

    const formDataToSend = new FormData();
    formDataToSend.append("file", file);

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      body: formDataToSend,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to process file" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return apiAuthErrorResponse(error);
  }
}
