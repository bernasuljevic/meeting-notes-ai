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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        alignItems: "center",
      }}
    >
      <h2>Ses Kaydı</h2>

      <div
        style={{
          display: "flex",
          gap: "10px",
        }}
      >
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
        <div
          style={{
            width: "250px",
            height: "15px",
            background: "#ddd",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${level * 100}%`,
              height: "100%",
              background: "green",
              transition: "width 0.05s",
            }}
          />
        </div>
      )}

      {error && (
        <p style={{ color: "red" }}>
          Hata: {error}
        </p>
      )}

      {audioBlob && !isRecording && (
        <div>
          Kayıt hazır (
          {(audioBlob.size / 1024).toFixed(1)} KB, WAV)
        </div>
      )}
    </div>
  );
}