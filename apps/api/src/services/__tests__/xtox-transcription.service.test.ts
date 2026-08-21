import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { XtoxTranscriptionError, XtoxTranscriptionService } from '../xtox-transcription.service';

const originalEnvironment = {
  feature: process.env.FEATURE_VOICE_TRANSCRIPTION,
  baseUrl: process.env.XTOX_BASE_URL,
  ephemeralVerified: process.env.XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED,
  timeout: process.env.XTOX_TRANSCRIBE_TIMEOUT_MS,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('FEATURE_VOICE_TRANSCRIPTION', originalEnvironment.feature);
  restore('XTOX_BASE_URL', originalEnvironment.baseUrl);
  restore('XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED', originalEnvironment.ephemeralVerified);
  restore('XTOX_TRANSCRIBE_TIMEOUT_MS', originalEnvironment.timeout);
});

const input = {
  bytes: Buffer.from('synthetic-audio'),
  fileName: 'voice.opus',
  contentType: 'audio/ogg',
  mystiraAuthorization: 'Bearer user-access-token',
};

describe('XtoxTranscriptionService', () => {
  it('fails closed while voice transcription is disabled', async () => {
    delete process.env.FEATURE_VOICE_TRANSCRIPTION;
    const fetcher = jest.fn<typeof fetch>();

    await expect(
      new XtoxTranscriptionService(fetcher).transcribe(input)
    ).rejects.toMatchObject<XtoxTranscriptionError>({ code: 'VOICE_TRANSCRIPTION_DISABLED' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires verified non-retaining xtox behavior before sending audio', async () => {
    process.env.FEATURE_VOICE_TRANSCRIPTION = 'true';
    process.env.XTOX_BASE_URL = 'https://api.xtox.example';
    delete process.env.XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED;
    const fetcher = jest.fn<typeof fetch>();

    await expect(
      new XtoxTranscriptionService(fetcher).transcribe(input)
    ).rejects.toMatchObject<XtoxTranscriptionError>({ code: 'XTOX_EPHEMERAL_MODE_NOT_VERIFIED' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards one audio file with user auth and requests non-retention', async () => {
    process.env.FEATURE_VOICE_TRANSCRIPTION = 'true';
    process.env.XTOX_BASE_URL = 'https://api.xtox.example/';
    process.env.XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED = 'true';
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'transcription-1',
          success: true,
          text: '  Synthetic transcript. ',
          language: 'en',
          duration: 1.25,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await new XtoxTranscriptionService(fetcher).transcribe({
      ...input,
      language: 'en',
    });

    expect(result).toEqual({
      id: 'transcription-1',
      text: 'Synthetic transcript.',
      language: 'en',
      duration: 1.25,
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(
      'https://api.xtox.example/api/transcribe-audio?retain=false&language=en'
    );
    expect(init?.headers).toEqual({ Authorization: 'Bearer user-access-token' });
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it('does not surface an upstream response body that may contain conversation content', async () => {
    process.env.FEATURE_VOICE_TRANSCRIPTION = 'true';
    process.env.XTOX_BASE_URL = 'https://api.xtox.example';
    process.env.XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED = 'true';
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('sensitive provider detail', { status: 502 }));

    await expect(
      new XtoxTranscriptionService(fetcher).transcribe(input)
    ).rejects.toMatchObject<XtoxTranscriptionError>({
      code: 'XTOX_REJECTED_AUDIO',
      upstreamStatus: 502,
    });
  });

  it('rejects an invalid language hint before sending audio', async () => {
    process.env.FEATURE_VOICE_TRANSCRIPTION = 'true';
    process.env.XTOX_BASE_URL = 'https://api.xtox.example';
    process.env.XTOX_EPHEMERAL_TRANSCRIPTION_VERIFIED = 'true';
    const fetcher = jest.fn<typeof fetch>();

    await expect(
      new XtoxTranscriptionService(fetcher).transcribe({ ...input, language: '../secrets' })
    ).rejects.toMatchObject<XtoxTranscriptionError>({ code: 'XTOX_REJECTED_AUDIO' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
