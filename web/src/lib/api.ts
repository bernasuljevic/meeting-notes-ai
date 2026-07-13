const API_BASE_URL = "";

export interface TranscribeResponse {
  seq: number;
  fileName: string;
  size: number;
  transcript: string;
}

/**
 * Kaydedilen ses parçasını (chunk) backend'e gönderir ve Whisper transkripsiyonunu döner.
 * `seq`, parçaların doğru sırayla birleştirilebilmesi için zorunlu.
 */
export async function transcribeAudio(audioBlob: Blob, seq: number): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");
  formData.append("seq", String(seq));

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let detail = `İstek başarısız: ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? errorBody.error ?? errorBody.message ?? detail;
    } catch {
      // JSON parse edilemezse, varsayılan mesajı kullan
    }
    throw new Error(detail);
  }

  return response.json();
}

export interface SummarizeResponse {
  generalSummary: string;
  decisions: string[];
  actionItems: string[];
  openIssuesAndRisks: string[];
  keyDiscussionPoints: string[];
}

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
  const response = await fetch(`${API_BASE_URL}/api/meetings`);

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

export async function deleteMeeting(id: string) {
  const response = await fetch(`${API_BASE_URL}/api/meetings/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Toplantı silinemedi.");
  }
}

export async function getMeeting(id: string): Promise<MeetingDetail> {
  const response = await fetch(`${API_BASE_URL}/api/meetings/${id}`);

  if (!response.ok) {
    throw new Error("Toplantı bulunamadı.");
  }

  return await response.json();
}

/**
 * Toplantıyı (transkript + yapay zekâ özeti) Word (.docx) veya PDF olarak indirir.
 * Dosya backend'de üretilir, burada sadece blob olarak alınıp tarayıcıya indirilir.
 */
export async function downloadMeetingExport(
  id: string,
  format: "docx" | "pdf",
  fileName: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/meetings/${id}/export/${format}`);

  if (!response.ok) {
    throw new Error(
      format === "docx" ? "Word dosyası oluşturulamadı." : "PDF dosyası oluşturulamadı."
    );
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
}

/**
 * Toplantı transkripti hakkında serbest metin bir soru sorar ve yapay zekâ yanıtını döner.
 * Her soru bağımsız değerlendirilir; önceki soru/cevaplar backend'e gönderilmez
 * (sohbet geçmişi sadece ekranda, istemci tarafında gösterim amaçlı tutulur).
 */
export async function askMeetingQuestion(id: string, question: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/meetings/${id}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    let detail = "Soru cevaplanamadı.";
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? errorBody.error ?? detail;
    } catch {
      // JSON parse edilemezse varsayılan mesaj kullanılır
    }
    throw new Error(detail);
  }

  const data = await response.json();
  return data.answer as string;
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

export async function createMeeting(request: CreateMeetingRequest): Promise<CreateMeetingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/meetings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Toplantı kaydedilemedi.");
  }

  return await response.json();
}