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

// --- YENİ EKLENEN / GÜNCELLENEN KISIM: Yapılandırılmış özet ---

export interface SummarizeResponse {
  generalSummary: string;
  decisions: string[];
  actionItems: string[];
}

/**
 * Transcript metnini backend'e gönderir, yapılandırılmış toplantı özeti döner
 * (genel özet + kararlar + yapılacaklar).
 * Şimdilik backend gerçek AI özetlemesi yapmıyor (placeholder), sabit örnek
 * veri döndürüyor. İleride Claude API bağlanınca bu fonksiyon DEĞİŞMEYECEK,
 * sadece backend tarafında gerçek AI çıktısı dönmeye başlayacak.
 */
export async function summarizeTranscript(transcript: string): Promise<SummarizeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    let detail = `İstek başarısız: ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? errorBody.error ?? detail;
    } catch {
      // JSON parse edilemezse varsayılan mesaj kullanılır
    }
    throw new Error(detail);
  }

  return response.json();
}