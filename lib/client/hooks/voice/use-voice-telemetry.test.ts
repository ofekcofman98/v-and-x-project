import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '@/lib/client/stores/ui-store';
import { voiceTelemetry } from './use-voice-telemetry';

const initialUIState = useUIStore.getState();

beforeEach(() => {
  useUIStore.setState(initialUIState, true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voiceTelemetry.begin', () => {
  it('returns a non-empty requestId and seeds vadStartAt', () => {
    const requestId = voiceTelemetry.begin();
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);

    voiceTelemetry.flush(requestId);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.requestId).toBe(requestId);
    expect(body.vadStartAt).toBeTruthy();
  });

  it('returns a different requestId on each call', () => {
    const a = voiceTelemetry.begin();
    const b = voiceTelemetry.begin();
    expect(a).not.toBe(b);
  });
});

describe('voiceTelemetry.mark / setConfirmationRoute / merge', () => {
  it('mark stamps the given field on an in-flight entry', () => {
    const requestId = voiceTelemetry.begin();
    voiceTelemetry.mark(requestId, 'recordingStopAt', '2026-08-22T10:00:02.000Z');

    voiceTelemetry.flush(requestId);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.recordingStopAt).toBe('2026-08-22T10:00:02.000Z');
  });

  it('mark is a no-op for an untracked requestId', () => {
    expect(() => voiceTelemetry.mark('unknown-id', 'recordingStopAt')).not.toThrow();
  });

  it('setConfirmationRoute sets the route on an in-flight entry', () => {
    const requestId = voiceTelemetry.begin();
    voiceTelemetry.setConfirmationRoute(requestId, 'abandoned');

    voiceTelemetry.flush(requestId);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.confirmationRoute).toBe('abandoned');
  });

  it('merge copies server-returned spans onto the in-flight entry', () => {
    const requestId = voiceTelemetry.begin();
    voiceTelemetry.merge(requestId, {
      transcriptionStartAt: '2026-08-22T10:00:02.100Z',
      transcriptionEndAt: '2026-08-22T10:00:03.400Z',
      matchingTierUsed: 'exact',
    });

    voiceTelemetry.flush(requestId);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.transcriptionStartAt).toBe('2026-08-22T10:00:02.100Z');
    expect(body.transcriptionEndAt).toBe('2026-08-22T10:00:03.400Z');
    expect(body.matchingTierUsed).toBe('exact');
  });

  it('merge is a no-op when spans is undefined', () => {
    const requestId = voiceTelemetry.begin();
    expect(() => voiceTelemetry.merge(requestId, undefined)).not.toThrow();

    voiceTelemetry.flush(requestId);
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.transcriptionStartAt).toBeUndefined();
  });
});

describe('voiceTelemetry.flush', () => {
  it('POSTs the accumulated entry to /api/voice-telemetry', () => {
    const requestId = voiceTelemetry.begin();
    voiceTelemetry.mark(requestId, 'dbWriteAckAt');
    voiceTelemetry.setConfirmationRoute(requestId, 'auto');

    voiceTelemetry.flush(requestId);

    expect(fetch).toHaveBeenCalledWith(
      '/api/voice-telemetry',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('reads the interim transcript from the UI store at flush time as webSttTranscript', () => {
    const requestId = voiceTelemetry.begin();
    useUIStore.getState().setProvisionalFeedback({ interimTranscript: 'noa cohen eighty four' });

    voiceTelemetry.flush(requestId);

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.webSttTranscript).toBe('noa cohen eighty four');
  });

  it('is idempotent — a second flush for the same requestId is a no-op (no extra fetch)', () => {
    const requestId = voiceTelemetry.begin();

    voiceTelemetry.flush(requestId);
    voiceTelemetry.flush(requestId);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('flushing an untracked requestId does not call fetch', () => {
    voiceTelemetry.flush('never-begun');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never throws when the fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const requestId = voiceTelemetry.begin();
    expect(() => voiceTelemetry.flush(requestId)).not.toThrow();

    // Let the rejected promise's .catch() microtask run.
    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
