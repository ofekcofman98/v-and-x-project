/**
 * Voice Metrics Monitoring
 * Based on: docs/05_VOICE_PIPELINE.md §8.2
 */

interface VoiceMetricsData {
  phase: 'transcribe' | 'parse' | 'voice-entry' | 'total';
  duration: number;
  success: boolean;
  error?: string;
}

const LATENCY_BUDGETS = {
  transcribe: 2000, // 2 seconds
  parse: 1000, // 1 second
  'voice-entry': 2500, // 2.5 seconds (combined transcribe + parse)
  total: 3500, // 3.5 seconds
};

export function trackVoiceMetrics(data: VoiceMetricsData) {
  const budget = LATENCY_BUDGETS[data.phase];
  const exceeded = data.duration > budget;

  const logData = {
    phase: data.phase,
    duration: data.duration,
    budget,
    exceeded,
    success: data.success,
    error: data.error,
  };

  if (exceeded) {
    console.warn(`[Performance] ${data.phase} exceeded budget:`, logData);
  } else {
    console.log(`[Performance] ${data.phase}:`, logData);
  }

  // Send to analytics if available
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'voice_input', {
      phase: data.phase,
      duration: data.duration,
      success: data.success,
      exceeded,
      error: data.error,
    });
  }

  return logData;
}
