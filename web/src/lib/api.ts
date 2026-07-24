const API_BASE_URL = "";

/**
 * Bir fetch yanıtı başarısız olduğunda, backend'in döndüğü { error } / { detail } /
 * { message } gövdesinden okunabilir bir hata metni çıkarır; yoksa fallback'i kullanır.
 */
async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const errorBody = await response.json();
    return errorBody.error ?? errorBody.detail ?? errorBody.message ?? fallback;
  } catch {
    return fallback;
  }
}

export interface TranscribeResponse {
  seq: number;
  fileName: string;
  size: number;
  transcript: string;
}

/**
 * Kaydedilen ses parçasını (chunk) backend'e gönderir ve Whisper transkripsiyonunu döner.
 * `seq`, parçaların doğru sırayla birleştirilebilmesi için zorunlu. `previousContext`
 * (opsiyonel) bir önceki parçanın transkript metnidir; Whisper'a bağlam olarak geçilip
 * cümle ortası kesilen parçalarda doğruluğu artırır. `meetingId` (opsiyonel) verilirse,
 * backend transkripti aynı anda o toplantıya kalıcı olarak da yazar (canlı kayıt sırasında
 * veri kaybı olmaması için) — bkz. startMeeting.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  seq: number,
  previousContext?: string,
  meetingId?: string
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.wav");
  formData.append("seq", String(seq));

  if (previousContext) {
    formData.append("previousContext", previousContext);
  }

  if (meetingId) {
    formData.append("meetingId", meetingId);
  }

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

/**
 * Not: /api/summarize artık giriş yapmayı zorunlu kılıyor (yapay zekâ, çağıran
 * kullanıcının kendi sağlayıcı/model/token ayarıyla çalışıyor) — bu yüzden
 * `token` zorunlu bir parametre. Giriş yapılmamışsa bu fonksiyon hiç çağrılmamalı;
 * çağıran taraf (useRecorder) bunu zaten kontrol ediyor.
 */
export async function summarizeTranscript(
  transcript: string,
  token: string
): Promise<SummarizeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorDetail(response, `İstek başarısız: ${response.status}`)
    );
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
/**
 * Not: /api/meetings/{id}/chat de giriş yapmayı zorunlu kılıyor, bkz.
 * summarizeTranscript'teki açıklama. `token` zorunlu.
 */
export async function askMeetingQuestion(
  id: string,
  question: string,
  token: string
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/meetings/${id}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "Soru cevaplanamadı."));
  }

  const data = await response.json();
  return data.answer as string;
}

export interface CreateMeetingRequest {
  title: string;
  startedAt: string;
  endedAt: string | null;
  transcript: string;
  // Backend'de nullable: giriş yapılmadan/AI ayarlanmadan kaydedilen bir
  // toplantıda AI özeti hiç üretilmemiş olabilir (bkz. Recorder.tsx'teki aiSkipped).
  summary: SummarizeResponse | null;
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

export interface StartMeetingRequest {
  title: string;
  startedAt: string;
}

export interface StartMeetingResponse {
  id: string;
}

/**
 * Kayıt başlar başlamaz çağrılır: sunucuda hemen (EndedAt = null) bir toplantı satırı
 * oluşturur. Dönen id, her /api/transcribe çağrısıyla birlikte gönderilip parçaların
 * canlı olarak bu toplantıya kaydedilmesini sağlar — tarayıcı kayıt bitmeden
 * çökerse/kapanırsa bile o ana kadarki transkript kaybolmaz.
 */
export async function startMeeting(request: StartMeetingRequest): Promise<StartMeetingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/meetings/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Toplantı başlatılamadı.");
  }

  return await response.json();
}

export interface FinalizeMeetingRequest {
  title: string;
  endedAt: string;
  summary: SummarizeResponse;
}

/**
 * Kayıt bitip yapay zekâ özeti hazır olunca çağrılır: startMeeting'te oluşturulan
 * toplantıyı gerçek başlık, bitiş zamanı ve özetle tamamlar.
 */
export async function finalizeMeeting(id: string, request: FinalizeMeetingRequest): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/meetings/${id}/finalize`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Toplantı tamamlanamadı.");
  }
}

// --- Giriş (login) + kullanıcıya özel AI ayarları ---
// Kayıt/transkript/toplantı listesi giriş yapmadan da kullanılabiliyor; sadece
// yapay zekâ özellikleri (özetleme, toplantı sohbeti) giriş + AI ayarı gerektiriyor.

export interface AuthResponse {
  token: string;
  username: string;
}

export interface MeResponse {
  username: string;
  hasAiConfigured: boolean;
  aiProvider: string | null;
  aiModel: string | null;
}

export async function registerUser(
  username: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "Kayıt oluşturulamadı."));
  }

  return response.json();
}

export async function loginUser(
  username: string,
  password: string
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(
      await parseErrorDetail(response, "Kullanıcı adı ya da şifre hatalı.")
    );
  }

  return response.json();
}

export async function getMe(token: string): Promise<MeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Kullanıcı bilgisi alınamadı.");
  }

  return response.json();
}

/**
 * AI sağlayıcı/model/token ayarlarını günceller. `apiToken` boş bırakılırsa
 * (undefined ya da boş string) backend mevcut şifreli token'a dokunmuyor —
 * "token'ı değiştirmek istemiyorsan boş bırak" davranışı bu sayede çalışıyor.
 */
export async function updateAiSettings(
  token: string,
  provider: string,
  model: string,
  apiToken?: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/ai-settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      provider,
      model,
      apiToken: apiToken && apiToken.length > 0 ? apiToken : null,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, "AI ayarları kaydedilemedi."));
  }
}