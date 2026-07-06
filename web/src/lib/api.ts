// web/src/lib/api.ts

const API_BASE_URL = "http://localhost:5166";

export interface TranscribeResponse {
  fileName: string;
  sizeBytes: number;
  transcript: string;
}

/**
 * Kaydedilen ses blob'unu backend'e gönderir ve Whisper transkripsiyonunu döner.
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    // Backend'in Results.Problem ile döndürdüğü hata detayını okumaya çalış
    let detail = `İstek başarısız: ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? errorBody.error ?? detail;
    } catch {
      // JSON parse edilemezse, varsayılan mesajı kullan
    }
    throw new Error(detail);
  }

  return response.json();
}