import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VoiceInteractionMetrics } from '@/lib/shared/types/voice-telemetry';

const createMock = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    voiceInteraction: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

let accuracyEnabled = false;
vi.mock('./config', () => ({
  get VOICE_ACCURACY_TELEMETRY_ENABLED() {
    return accuracyEnabled;
  },
}));

import { recordVoiceInteraction } from './voice-interaction-service';

beforeEach(() => {
  createMock.mockReset();
  accuracyEnabled = false;
});

function baseMetrics(overrides: Partial<VoiceInteractionMetrics> = {}): VoiceInteractionMetrics {
  return { requestId: 'req-1', ...overrides };
}

describe('recordVoiceInteraction — duration arithmetic', () => {
  it('computes each duration from its start/end timestamp pair', async () => {
    await recordVoiceInteraction(
      baseMetrics({
        vadStartAt: '2026-08-22T10:00:00.000Z',
        recordingStopAt: '2026-08-22T10:00:02.000Z',
        transcriptionStartAt: '2026-08-22T10:00:02.100Z',
        transcriptionEndAt: '2026-08-22T10:00:03.400Z',
        llmParseStartAt: '2026-08-22T10:00:03.500Z',
        llmParseEndAt: '2026-08-22T10:00:05.000Z',
        matchingStartAt: '2026-08-22T10:00:05.010Z',
        matchingEndAt: '2026-08-22T10:00:05.040Z',
        confirmShownAt: '2026-08-22T10:00:05.100Z',
        confirmReceivedAt: '2026-08-22T10:00:06.100Z',
        dbWriteAckAt: '2026-08-22T10:00:06.200Z',
      })
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    const data = createMock.mock.calls[0][0].data;

    expect(data.recordingDurationMs).toBe(2000);
    expect(data.transcriptionDurationMs).toBe(1300);
    expect(data.llmParseDurationMs).toBe(1500);
    expect(data.matchingDurationMs).toBe(30);
    expect(data.confirmWaitDurationMs).toBe(1000);
    expect(data.totalDurationMs).toBe(6200); // vadStartAt -> dbWriteAckAt
  });

  it('leaves a duration null when either boundary timestamp is missing', async () => {
    await recordVoiceInteraction(
      baseMetrics({
        vadStartAt: '2026-08-22T10:00:00.000Z',
        // recordingStopAt omitted
        transcriptionStartAt: '2026-08-22T10:00:02.100Z',
        transcriptionEndAt: '2026-08-22T10:00:03.400Z',
      })
    );

    const data = createMock.mock.calls[0][0].data;
    expect(data.recordingDurationMs).toBeNull();
    expect(data.transcriptionDurationMs).toBe(1300);
    expect(data.llmParseDurationMs).toBeNull();
    expect(data.matchingDurationMs).toBeNull();
    expect(data.confirmWaitDurationMs).toBeNull();
    // dbWriteAckAt missing -> totalDurationMs null too
    expect(data.totalDurationMs).toBeNull();
  });

  it('never produces a negative duration — treats an inverted pair as missing', async () => {
    await recordVoiceInteraction(
      baseMetrics({
        transcriptionStartAt: '2026-08-22T10:00:03.400Z',
        transcriptionEndAt: '2026-08-22T10:00:02.100Z', // end before start
      })
    );

    const data = createMock.mock.calls[0][0].data;
    expect(data.transcriptionDurationMs).toBeNull();
  });

  it('leaves a duration null on an unparseable timestamp string', async () => {
    await recordVoiceInteraction(
      baseMetrics({
        transcriptionStartAt: 'not-a-date',
        transcriptionEndAt: '2026-08-22T10:00:03.400Z',
      })
    );

    const data = createMock.mock.calls[0][0].data;
    expect(data.transcriptionDurationMs).toBeNull();
  });
});

describe('recordVoiceInteraction — accuracy flag gating', () => {
  it('nulls all four accuracy columns when the flag is off', async () => {
    accuracyEnabled = false;

    await recordVoiceInteraction(
      baseMetrics({
        webSttTranscript: 'noa cohen eighty four',
        whisperTranscript: 'Noa Cohen, 84',
        matchedEntityValue: 'Noa Cohen',
        matchingTierUsed: 'exact',
      })
    );

    const data = createMock.mock.calls[0][0].data;
    expect(data.webSttTranscript).toBeNull();
    expect(data.whisperTranscript).toBeNull();
    expect(data.matchedEntityValue).toBeNull();
    expect(data.matchingTierUsed).toBeNull();
  });

  it('populates all four accuracy columns when the flag is on', async () => {
    accuracyEnabled = true;

    await recordVoiceInteraction(
      baseMetrics({
        webSttTranscript: 'noa cohen eighty four',
        whisperTranscript: 'Noa Cohen, 84',
        matchedEntityValue: 'Noa Cohen',
        matchingTierUsed: 'exact',
      })
    );

    const data = createMock.mock.calls[0][0].data;
    expect(data.webSttTranscript).toBe('noa cohen eighty four');
    expect(data.whisperTranscript).toBe('Noa Cohen, 84');
    expect(data.matchedEntityValue).toBe('Noa Cohen');
    expect(data.matchingTierUsed).toBe('exact');
  });
});

describe('recordVoiceInteraction — confirmationRoute and requestId passthrough', () => {
  it('writes requestId and confirmationRoute verbatim', async () => {
    await recordVoiceInteraction(baseMetrics({ requestId: 'req-42', confirmationRoute: 'batch' }));

    const data = createMock.mock.calls[0][0].data;
    expect(data.requestId).toBe('req-42');
    expect(data.confirmationRoute).toBe('batch');
  });

  it('nulls confirmationRoute when absent', async () => {
    await recordVoiceInteraction(baseMetrics());

    const data = createMock.mock.calls[0][0].data;
    expect(data.confirmationRoute).toBeNull();
  });
});

describe('recordVoiceInteraction — never throws', () => {
  it('swallows a Prisma write failure and does not reject', async () => {
    createMock.mockRejectedValue(new Error('connection reset'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(recordVoiceInteraction(baseMetrics())).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
