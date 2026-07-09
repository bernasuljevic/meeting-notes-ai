// web/src/hooks/useRecorder.ts
import { useCallback, useRef, useState } from "react";
import { downsampleBuffer, mergeBuffers, calculateRMS, calculateRMSLevel, encodeWAV } from "../lib/audio";
import { transcribeAudio, summarizeTranscript, type SummarizeResponse } from "../lib/api";

const TARGET_SAMPLE_RATE = 16000; // Whisper'ın beklediği format
const PROCESSOR_BUFFER_SIZE = 4096; // ScriptProcessorNode'un işleyeceği örnek sayısı

// Parçalama ayarları (MIMARI_1.md bölüm 5.2 / 9)
const MIN_FLUSH_SEC = 11; // en az bu kadar biriktikten sonra sessizlikte gönder
const MAX_CHUNK_SEC = 22; // sessizlik olmasa bile bu süreyi geçince zorunlu gönder
const MIN_CHUNK_SEC = 1; // bundan kısa parçayı hiç gönderme
const SILENCE_RMS = 0.012; // bu eşiğin altı "sessizlik" sayılır

interface UseRecorderReturn {
  isRecording: boolean;
  isFinalizing: boolean; // "Bitir"den sonra bekleyen istekler + not oluşturma sürüyor
  level: number; // 0-1 arası, canlı mikrofon seviyesi
  durationSec: number; // kayıt süresi (saniye), her saniye bir artar
  transcript: string; // seq sırasına göre birleşmiş, canlı güncellenen transkript
  notes: SummarizeResponse | null;
  audioBlob: Blob | null; // tüm kaydın birleşik WAV hali (yerel oynatma/indirme için)
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [level, setLevel] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState<SummarizeResponse | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  const fullRecordingRef = useRef<Float32Array[]>([]); // yerel oynatma için TÜM kayıt
  const pendingChunkRef = useRef<Float32Array[]>([]); // henüz gönderilmemiş, biriken parça
  const pendingSampleCountRef = useRef(0);
  const nextSeqRef = useRef(0);
  const transcriptPartsRef = useRef<Map<number, string>>(new Map());
  const pendingRequestsRef = useRef<Promise<void>[]>([]);

  const updateTranscriptState = useCallback(() => {
    const sortedSeqs = Array.from(transcriptPartsRef.current.keys()).sort((a, b) => a - b);
    const combined = sortedSeqs
      .map((seq) => transcriptPartsRef.current.get(seq))
      .join(" ")
      .trim();
    setTranscript(combined);
  }, []);

  const flushPendingChunk = useCallback(() => {
    if (pendingSampleCountRef.current === 0) return;

    const durationSec = pendingSampleCountRef.current / TARGET_SAMPLE_RATE;
    const chunks = pendingChunkRef.current;

    pendingChunkRef.current = [];
    pendingSampleCountRef.current = 0;

    if (durationSec < MIN_CHUNK_SEC) {
      // Çok kısa parça, göndermeye değmez
      return;
    }

    const merged = mergeBuffers(chunks);
    const wavBlob = encodeWAV(merged, TARGET_SAMPLE_RATE);
    const seq = nextSeqRef.current++;

    // Fire-and-forget: beklemeden gönder, dönen sonucu seq'e göre yerleştir
    const request = transcribeAudio(wavBlob, seq)
      .then((result) => {
        transcriptPartsRef.current.set(seq, result.transcript);
        updateTranscriptState();
      })
      .catch((err) => {
        console.error(`[useRecorder] Parça #${seq} transkript edilemedi:`, err);
      });

    pendingRequestsRef.current.push(request);
  }, [updateTranscriptState]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setTranscript("");
    setNotes(null);
    setDurationSec(0);

    fullRecordingRef.current = [];
    pendingChunkRef.current = [];
    pendingSampleCountRef.current = 0;
    nextSeqRef.current = 0;
    transcriptPartsRef.current = new Map();
    pendingRequestsRef.current = [];

    try {
      // 1. Mikrofon izni iste ve stream al (echo/gürültü/otomatik kazanç kapalı bırakılmaz)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. AudioContext oluştur (tarayıcının verdiği doğal örnekleme hızıyla, genelde 48000 Hz)
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // 3. Mikrofon stream'ini bir audio node'una çevir
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // 4. Ham sesi işlemek için ScriptProcessorNode oluştur (mono giriş/çıkış)
      const processor = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      processorNodeRef.current = processor;

      // 5. Sesi duymamak için sessiz bir GainNode (feedback/geri besleme önleme)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      gainNodeRef.current = gainNode;

      // 6. Her ses bloğu geldiğinde çalışacak callback
      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Canlı seviye göstergesi
        setLevel(calculateRMSLevel(inputData));

        // 48kHz -> 16kHz downsample et
        const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, TARGET_SAMPLE_RATE);

        // Yerel oynatma için tam kayda ekle
        fullRecordingRef.current.push(downsampled);

        // Gönderilecek parçaya ekle
        pendingChunkRef.current.push(downsampled);
        pendingSampleCountRef.current += downsampled.length;

        const pendingDurationSec = pendingSampleCountRef.current / TARGET_SAMPLE_RATE;
        const isSilent = calculateRMS(inputData) < SILENCE_RMS;

        const shouldFlushOnPause = pendingDurationSec >= MIN_FLUSH_SEC && isSilent;
        const shouldFlushOnCeiling = pendingDurationSec >= MAX_CHUNK_SEC;

        if (shouldFlushOnPause || shouldFlushOnCeiling) {
          flushPendingChunk();
        }
      };

      // 7. Audio graph'ı bağla: mikrofon -> processor -> (sessiz gain) -> hoparlör
      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      setIsRecording(true);

      // 8. Süre sayacını başlat (her saniye bir artır)
      durationIntervalRef.current = window.setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mikrofona erişim sağlanamadı.";
      setError(message);
      setIsRecording(false);
    }
  }, [flushPendingChunk]);

  const stopRecording = useCallback(() => {
    // Node bağlantılarını kopar (bundan sonra onaudioprocess tetiklenmez)
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    gainNodeRef.current?.disconnect();

    // Mikrofon erişimini tamamen kapat
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

    // AudioContext'i kapat
    audioContextRef.current?.close();

    // Tamponda kalan son parçayı da gönder (süre eşiği aranmadan)
    flushPendingChunk();

    // Yerel oynatma için tüm kaydı WAV'a çevir
    const fullMerged = mergeBuffers(fullRecordingRef.current);
    const fullWavBlob = encodeWAV(fullMerged, TARGET_SAMPLE_RATE);
    setAudioBlob(fullWavBlob);

    setIsRecording(false);
    setLevel(0);

    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setIsFinalizing(true);

    // Bekleyen tüm transkript istekleri bitince, birleşik metni notlara gönder
    const finalize = async () => {
      try {
        await Promise.all(pendingRequestsRef.current);

        const sortedSeqs = Array.from(transcriptPartsRef.current.keys()).sort((a, b) => a - b);
        const finalTranscript = sortedSeqs
          .map((seq) => transcriptPartsRef.current.get(seq))
          .join(" ")
          .trim();

        setTranscript(finalTranscript);

        if (finalTranscript.length > 0) {
          const summary = await summarizeTranscript(finalTranscript);
          setNotes(summary);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Notlar oluşturulamadı.";
        setError(message);
      } finally {
        setIsFinalizing(false);
      }
    };

    finalize();

    // Referansları temizle
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;
  }, [flushPendingChunk]);

  return {
    isRecording,
    isFinalizing,
    level,
    durationSec,
    transcript,
    notes,
    audioBlob,
    error,
    startRecording,
    stopRecording,
  };
}