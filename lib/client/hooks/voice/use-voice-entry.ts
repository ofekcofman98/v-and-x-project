/**
 * useVoiceEntry Hook
 * Manages the voice recording lifecycle: idle -> listening -> processing -> success/error
 * Based on: docs/05_VOICE_PIPELINE.md §2.1
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceEntryOptions {
  onAudioReady: (audioBlob: Blob) => void;
  onError: (error: Error) => void;
}

interface UseVoiceEntryReturn {
  isRecording: boolean;
  audioLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cleanup: () => void;
}

/**
 * Custom hook for voice recording with MediaRecorder
 * Handles microphone access, audio capture, and level monitoring
 */
export function useVoiceEntry({
  onAudioReady,
  onError,
}: UseVoiceEntryOptions): UseVoiceEntryReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Start recording audio from microphone
   */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        onAudioReady(audioBlob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      setupAudioLevelMonitoring(stream);
    } catch (error) {
      const errorObj = error as Error;
      
      if (errorObj.name === 'NotAllowedError') {
        onError(new Error('Microphone access denied. Please allow microphone access in your browser settings.'));
      } else if (errorObj.name === 'NotFoundError') {
        onError(new Error('No microphone detected. Please connect a microphone and try again.'));
      } else {
        onError(new Error('Failed to start recording. Please try again.'));
      }
    }
  }, [onAudioReady, onError]);

  /**
   * Stop recording and trigger audio processing
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setAudioLevel(0);
    }
  }, [isRecording]);

  /**
   * Setup real-time audio level monitoring for visual feedback
   */
  const setupAudioLevelMonitoring = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    
    analyser.fftSize = 256;
    microphone.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalized = average / 255;
      
      setAudioLevel(normalized);
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  };

  /**
   * Cleanup function to stop all recording and monitoring
   */
  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
    cleanup,
  };
}