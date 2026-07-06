// web/src/hooks/useRecorder.ts
import { useCallback, useRef, useState } from "react";
import { downsampleBuffer, mergeBuffers, calculateRMSLevel, encodeWAV } from "../lib/audio";

const TARGET_SAMPLE_RATE = 16000; // Whisper'ın beklediği format (ileride kullanılacak)
const PROCESSOR_BUFFER_SIZE = 4096; // ScriptProcessorNode'un işleyeceği örnek sayısı

interface UseRecorderReturn {
  isRecording: boolean;
  level: number; // 0-1 arası, canlı mikrofon seviyesi
  audioBlob: Blob | null; // Kayıt bitince oluşan WAV dosyası
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bileşen yeniden render olsa bile bu referanslar aynı kalır (state'e bağlı değil)
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    recordedChunksRef.current = [];

    try {
      // 1. Mikrofon izni iste ve stream al
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. AudioContext oluştur (tarayıcının verdiği doğal örnekleme hızıyla, genelde 48000 Hz)
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // 3. Mikrofon stream'ini bir audio node'una çevir
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // 4. Ham sesi işlemek için ScriptProcessorNode oluştur
      //    (1 giriş kanalı, 1 çıkış kanalı - mono)
      const processor = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      processorNodeRef.current = processor;

      // 5. Sesi duymamak için sessiz bir GainNode (feedback/geri besleme önleme)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      gainNodeRef.current = gainNode;

      // 6. Her ses bloğu geldiğinde çalışacak callback
      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        const inputData = event.inputBuffer.getChannelData(0);

        // Canlı seviye göstergesi için RMS hesapla
        setLevel(calculateRMSLevel(inputData));

        // 48kHz -> 16kHz downsample et ve BELLEKTE bir KOPYASINI tut
        // (inputData buffer'ı Web Audio API tarafından her seferinde yeniden
        // kullanıldığı için, downsampleBuffer zaten yeni bir array döndürür)
        const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, TARGET_SAMPLE_RATE);
        recordedChunksRef.current.push(downsampled);
      };

      // 7. Audio graph'ı bağla: mikrofon -> processor -> (sessiz gain) -> hoparlör
      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioContext.destination);

      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Mikrofona erişim sağlanamadı.";
      setError(message);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    // Node bağlantılarını kopar
    processorNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    gainNodeRef.current?.disconnect();

    // Mikrofon erişimini tamamen kapat (tarayıcıdaki kırmızı kayıt ikonunu söndürür)
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

    // AudioContext'i kapat
    audioContextRef.current?.close();

    // Tüm parçaları birleştir ve WAV'a çevir
    const merged = mergeBuffers(recordedChunksRef.current);
    const wavBlob = encodeWAV(merged, TARGET_SAMPLE_RATE);
    setAudioBlob(wavBlob);
    const url = URL.createObjectURL(wavBlob);
window.open(url);

    const sendAudio = async () => {
  const formData = new FormData();

  formData.append(
    "audio",
    wavBlob,
    "recording.wav"
  );

  const response = await fetch(
    "http://localhost:5166/api/transcribe",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  console.log(
  "[Backend cevabı]",
  JSON.stringify(data, null, 2)
);
};

sendAudio();

    const durationSeconds = merged.length / TARGET_SAMPLE_RATE;
    console.log(
      `[useRecorder] Kayıt tamamlandı: ${durationSeconds.toFixed(2)} saniye, ` +
      `${merged.length} örnek, ${TARGET_SAMPLE_RATE} Hz mono.`
    );

    // Referansları temizle
    processorNodeRef.current = null;
    sourceNodeRef.current = null;
    gainNodeRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;

    setIsRecording(false);
    setLevel(0);
  }, []);

  return { isRecording, level, audioBlob, error, startRecording, stopRecording };
}