export type XtoxTranscriptionErrorCode =
  | 'VOICE_TRANSCRIPTION_DISABLED'
  | 'XTOX_NOT_CONFIGURED'
  | 'XTOX_EPHEMERAL_MODE_NOT_VERIFIED'
  | 'XTOX_AUTH_REJECTED'
  | 'XTOX_UNAVAILABLE'
  | 'XTOX_REJECTED_AUDIO'
  | 'XTOX_INVALID_RESPONSE';

export class XtoxTranscriptionError extends Error {
  constructor(
    public readonly code: XtoxTranscriptionErrorCode,
    public readonly upstreamStatus?: number
  ) {
    super(code);
  }
}

export interface XtoxTranscriptionResult {
  id: string;
  text: string;
  language?: string;
  duration?: number;
}

interface XtoxPayload {
  id?: unknown;
  success?: unknown;
  text?: unknown;
  language?: unknown;
  duration?: unknown;
}

export interface TranscribeAudioInput {
  bytes: Buffer;
  fileName: string;
  contentType: string;
  mystiraAuthorization: string;
  language?: string;
}

export class XtoxTranscriptionService {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  assertReady(): string {
    if (process.env.FEATURE_VOICE_TRANSCRIPTION !== 'true') {
      throw new XtoxTranscriptionError('VOICE_TRANSCRIPTION_DISABLED');
    }
    const baseUrl = process.env.XTOX_BASE_URL?.trim().replace(/\/$/, '');
    if (!baseUrl) throw new XtoxTranscriptionError('XTOX_NOT_CONFIGURED');
    // This is an evidence gate, not a capability guess. xtox currently persists
    // transcripts by default; production must only set this after its retain=false
    // contract has been deployed and verified against the configured hostname.
    if (process.env.XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED !== 'true') {
      throw new XtoxTranscriptionError('XTOX_EPHEMERAL_MODE_NOT_VERIFIED');
    }
    return baseUrl;
  }

  async transcribe(input: TranscribeAudioInput): Promise<XtoxTranscriptionResult> {
    const baseUrl = this.assertReady();
    if (!/^Bearer\s+\S+$/i.test(input.mystiraAuthorization)) {
      throw new XtoxTranscriptionError('XTOX_AUTH_REJECTED');
    }

    const url = new URL(`${baseUrl}/api/transcribe-audio`);
    url.searchParams.set('retain', 'false');
    if (input.language && !/^[A-Za-z]{2}$/.test(input.language)) {
      throw new XtoxTranscriptionError('XTOX_REJECTED_AUDIO');
    }
    if (input.language) url.searchParams.set('language', input.language);
    const form = new FormData();
    form.append('file', new Blob([input.bytes], { type: input.contentType }), input.fileName);

    const controller = new AbortController();
    const configuredTimeout = Number.parseInt(
      process.env.XTOX_TRANSCRIBE_TIMEOUT_MS || '120000',
      10
    );
    const timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout >= 1000 && configuredTimeout <= 300000
        ? configuredTimeout
        : 120000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: { Authorization: input.mystiraAuthorization },
        body: form,
        signal: controller.signal,
      });
    } catch {
      throw new XtoxTranscriptionError('XTOX_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      throw new XtoxTranscriptionError('XTOX_AUTH_REJECTED', response.status);
    }
    if (response.status === 503 || response.status === 504) {
      throw new XtoxTranscriptionError('XTOX_UNAVAILABLE', response.status);
    }
    if (!response.ok) {
      throw new XtoxTranscriptionError('XTOX_REJECTED_AUDIO', response.status);
    }

    let payload: XtoxPayload;
    try {
      payload = (await response.json()) as XtoxPayload;
    } catch {
      throw new XtoxTranscriptionError('XTOX_INVALID_RESPONSE', response.status);
    }
    if (
      payload.success !== true ||
      typeof payload.id !== 'string' ||
      typeof payload.text !== 'string' ||
      payload.text.trim().length === 0
    ) {
      throw new XtoxTranscriptionError('XTOX_INVALID_RESPONSE', response.status);
    }

    return {
      id: payload.id,
      text: payload.text.trim(),
      ...(typeof payload.language === 'string' ? { language: payload.language } : {}),
      ...(typeof payload.duration === 'number' && Number.isFinite(payload.duration)
        ? { duration: payload.duration }
        : {}),
    };
  }
}

export const xtoxTranscriptionService = new XtoxTranscriptionService();
