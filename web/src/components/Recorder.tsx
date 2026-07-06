// web/src/components/Recorder.tsx

import { useRecorder } from "../hooks/useRecorder";

export function Recorder() {
  const {
    isRecording,
    level,
    audioBlob,
    error,
    startRecording,
    stopRecording,
  } = useRecorder();

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <h2 className="text-xl font-semibold">Ses Kaydı</h2>

      <div className="flex gap-3">
        <button
          onClick={startRecording}
          disabled={isRecording}
        >
          Start Recording
        </button>

        <button
          onClick={stopRecording}
          disabled={!isRecording}
        >
          Stop Recording
        </button>
      </div>

      {isRecording && (
        <div className="w-64 h-3 bg-gray-200 rounded overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-75"
            style={{ width: `${level * 100}%` }}
          />
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm">
          Hata: {error}
        </p>
      )}

      {audioBlob && !isRecording && (
        <div className="text-sm text-gray-600">
          Kayıt hazır (
          {(audioBlob.size / 1024).toFixed(1)} KB, WAV)
          — konsolu kontrol et.
        </div>
      )}
    </div>
  );
}