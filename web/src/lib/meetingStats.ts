// web/src/lib/meetingStats.ts
//
// MeetingHistory ve MeetingDetail ekranlarında ayrı ayrı yeniden yazılmaması
// için, sadece mevcut alanlardan (startedAt/endedAt/transcriptSegments)
// türetilen, tamamen görünüm amaçlı yardımcı fonksiyonlar. Veri modelini ya
// da API'yi değiştirmez.

/**
 * İki ISO zaman damgası arasındaki süreyi "1 sa 12 dk" / "12 dk" biçiminde döner.
 * endedAt yoksa veya süre negatif/anlamsızsa null döner.
 */
export function formatDuration(startedAt: string, endedAt: string | null): string | null {
  if (!endedAt) return null;

  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();

  if (!Number.isFinite(ms) || ms <= 0) return null;

  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours} sa ${minutes} dk` : `${minutes} dk`;
}

/** Transkript segmentlerini tek bir metinde birleştirir. */
export function joinTranscript(segments: Array<{ text: string }>): string {
  return segments.map((segment) => segment.text).join("\n\n");
}

/** Boşluğa göre kelime sayar (boş metin için 0). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Büyük sayıları "8.2b" gibi kısaltır; küçük sayılarda olduğu gibi gösterir. */
export function formatCompactCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}b`;
  }
  return count.toLocaleString("tr-TR");
}
