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
export interface MeetingListItem {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export async function getMeetings(): Promise<MeetingListItem[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/meetings`
  );

  if (!response.ok) {
    throw new Error("Toplantılar alınamadı.");
  }

  return await response.json();
}
export interface TranscriptSegment {
  id: string;
  seq: number;
  text: string;
}

export interface MeetingNote {
  id: string;
  markdownContent: string;
  model: string;
  createdAt: string;
}

export interface MeetingDetail {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  transcriptSegments: TranscriptSegment[];
  notes: MeetingNote[];
}

export async function getMeeting(
  id: string
): Promise<MeetingDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/meetings/${id}`
  );

  if (!response.ok) {
    throw new Error("Toplantı bulunamadı.");
  }

  return await response.json();
}
export interface CreateMeetingRequest {
  title: string;
  startedAt: string;
  endedAt: string | null;
  transcript: string;
  summary: SummarizeResponse;
}

export interface CreateMeetingResponse {
  id: string;
}

export async function createMeeting(
  request: CreateMeetingRequest
): Promise<CreateMeetingResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/meetings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error("Toplantı kaydedilemedi.");
  }

  return await response.json();
}