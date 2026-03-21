import { LRUCache } from 'lru-cache';

/**
 * Transcript Cache
 * 
 * Purpose: Cache audio hash → transcript to avoid re-transcribing identical audio
 * 
 * Use case: User accidentally records same thing twice
 * Impact: Rare but saves 1300ms when it happens
 */
class TranscriptCache {
  private cache: LRUCache<string, { text: string; duration: number }>;

  constructor() {
    this.cache = new LRUCache({
      max: 100,
      ttl: 1000 * 60 * 60,
      maxSize: 1024 * 1024,
      sizeCalculation: (value) => value.text.length,
    });
  }

  async getAudioHash(audioBlob: Blob): Promise<string> {
    const buffer = await audioBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async get(audioBlob: Blob): Promise<{ text: string; duration: number } | null> {
    const hash = await this.getAudioHash(audioBlob);
    return this.cache.get(hash) || null;
  }

  async set(audioBlob: Blob, text: string, duration: number): Promise<void> {
    const hash = await this.getAudioHash(audioBlob);
    this.cache.set(hash, { text, duration });
  }
}

export const transcriptCache = new TranscriptCache();
