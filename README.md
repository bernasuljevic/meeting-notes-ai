# Toplantı Notları (meeting-notes-ai)

Toplantı seslerini kaydedip gerçek zamanlı Türkçe transkript çıkaran, konuşma bitince yapay zekâ ile yapılandırılmış toplantı notları üreten ve tüm geçmişi kalıcı olarak saklayan bir uygulama.

Proje, ekip tarafından hazırlanan mimari döküman (`MIMARI_1.md`) referans alınarak geliştirilmiştir.

## Özellikler

- **Gerçek zamanlı ses kaydı ve transkripsiyon**: Tarayıcıda kaydedilen ses, küçük parçalara (chunk) bölünerek arka uca gönderilir; [Whisper.net](https://github.com/sandrohanea/whisper.net) ile cihaz üzerinde (on-device) Türkçe transkript üretilir. Herhangi bir ses verisi transkripsiyon için dışarı gönderilmez.
- **Yapay zekâ destekli toplantı özeti**: Toplantı bitince transkript, seçilen sağlayıcıya (Claude API veya yerel LLM) gönderilerek 5 bölümden oluşan yapılandırılmış bir özet üretilir: Genel Özet, Kararlar, Aksiyon Maddeleri, Açık Konular ve Riskler, Önemli Tartışma Noktaları. Hiçbir sağlayıcı ayarlanmamışsa sistem otomatik olarak düz metin tabanlı bir yedek servise (`PlainTextSummarizationService`) düşer, uygulama hiçbir zaman çökmez.
- **Değiştirilebilir özetleme sağlayıcısı (provider)**: Özetleme, tek bir sağlayıcıya bağlı değildir. Varsayılan olarak bulut tabanlı Claude API kullanılır; hassas/gizli içerikli toplantılarda transkriptin kurum dışına hiç çıkmaması isteniyorsa yapılandırma değiştirilerek [Ollama](https://ollama.com) üzerinden çalışan yerel bir LLM'e geçilebilir. Bkz. aşağıdaki "Özetleme sağlayıcısını değiştirme" bölümü.
- **Kalıcı depolama**: Toplantılar, transkript parçaları ve notlar EF Core + MSSQL ile veritabanında saklanır; geçmiş toplantılar listelenip tek tek detaylarına girilebilir.
- **Modern arayüz**: React + Vite + TypeScript + Tailwind + shadcn/ui ile geliştirilmiş, canlı seviye göstergesi (level meter), kayıt süresi sayacı ve toast bildirimleri içeren bir arayüz.
- **KVKK bilgilendirmesi**: Kayıt ekranında katılımcıları bilgilendirmek için kişisel verilerin işlenmesi hakkında bir uyarı notu bulunur.

## Mimari dökümandan bilinçli sapma

`MIMARI_1.md`'de öngörülen tamamen yerel (on-prem) LLM entegrasyonu yerine, ekip yönlendirmesiyle özetleme servisi için varsayılan olarak **Anthropic Claude API**'si kullanılmıştır. Bu, transkript metninin özet oluşturma amacıyla Claude API'ye gönderildiği anlamına gelir (ham ses verisi hiçbir zaman cihaz dışına çıkmaz). Bu değişiklik nedeniyle Recorder arayüzüne bir KVKK bilgilendirme notu eklenmiştir.

Bu sapmanın getirdiği gizlilik notunu esnetmek için özetleme servisi tek bir sağlayıcıya kilitlenmemiştir: `Summarization:Provider` ayarı üzerinden Claude yerine [Ollama](https://ollama.com) ile yerelde çalışan bir LLM'e geçilebilir. Böylece hassas olmayan toplantılarda Claude kullanılmaya devam edilirken, hassas/maskelenmesi gereken toplantılarda transkript hiç dışarı çıkmadan yerel modelle özetlenebilir. Detaylar için aşağıya bakın.

## Özetleme sağlayıcısını değiştirme (Claude / Yerel LLM)

`api/appsettings.json` içindeki `Summarization:Provider` alanı hangi özetleme servisinin kullanılacağını belirler:

| Değer | Davranış |
| --- | --- |
| `"auto"` (varsayılan) | `Claude:ApiKey` doluysa Claude API, boşsa düz metin özet kullanılır. |
| `"claude"` | Anthropic Claude API kullanılır (`Claude:ApiKey` gerekli). |
| `"ollama"` | Yerelde çalışan bir LLM kullanılır, transkript kurum dışına hiç çıkmaz. |
| `"plaintext"` | Yapay zekâ kullanılmadan düz metin özet üretilir. |

Yerel LLM ile devam etmek isterseniz:

1. Bilgisayarınıza [Ollama](https://ollama.com/download)'yı kurun ve bir model indirin, örneğin: `ollama pull llama3.1`
2. `Ollama serve` çalışır durumda olsun (varsayılan adres: `http://localhost:11434/`).
3. `api/appsettings.json` içinde:
   ```json
   "Summarization": { "Provider": "ollama" },
   "Ollama": { "BaseUrl": "http://localhost:11434/", "Model": "llama3.1" }
   ```
4. Backend'i yeniden başlatın — kod tarafında ek bir değişiklik gerekmez.

Bu tamamen opsiyonel bir esneklik katmanıdır; Claude API ile devam etmek isteyenler `Provider` alanına hiç dokunmasa da olur.

## Teknoloji yığını

**Backend (`api/`)**
- .NET 10 Minimal API
- Entity Framework Core + MSSQL
- Whisper.net (Türkçe konuşma tanıma)
- Anthropic Claude Messages API (özetleme, varsayılan sağlayıcı)
- Ollama (opsiyonel yerel LLM sağlayıcısı)

**Frontend (`web/`)**
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Web Audio API (ses yakalama ve chunk'lama)
- sonner (toast bildirimleri)

## Kurulum

### Gereksinimler

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (18+)
- SQL Server (LocalDB / Express yeterlidir)

### 1. Depoyu klonlayın

```bash
git clone https://github.com/bernasuljevic/meeting-notes-ai.git
cd meeting-notes-ai
```

### 2. Whisper modelini indirin

Konuşma tanıma modeli boyut nedeniyle depoya dahil edilmemiştir (`.gitignore` ile hariç tutulmuştur). `api/Models/` klasörü altına indirin:

```bash
cd api/Models
curl -L -o ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
cd ../..
```

### 3. Backend'i yapılandırın

`api/appsettings.json` içinde:

- `ConnectionStrings:DefaultConnection` — kendi SQL Server bağlantı bilginizi girin.
- `Claude:ApiKey` — Anthropic Claude API anahtarınızı girin. Boş bırakılırsa yapay zekâ özeti yerine düz metin özet üretilir, uygulama yine de çalışır.
- `Summarization:Provider` — özetleme sağlayıcısını seçer (`auto` / `claude` / `ollama` / `plaintext`). Detaylar için aşağıdaki "Özetleme sağlayıcısını değiştirme" bölümüne bakın.

### 4. Backend'i çalıştırın

```bash
cd api
dotnet restore
dotnet ef database update
dotnet run
```

### 5. Frontend'i çalıştırın

```bash
cd web
npm install
npm run dev
```

Frontend, geliştirme sunucusunda `/api` isteklerini otomatik olarak backend'e yönlendirecek şekilde yapılandırılmıştır (bkz. `web/vite.config.ts`).

## Durum

Uygulamanın kayıt, transkripsiyon, kalıcı saklama ve arayüz kısımları tamamlanmış ve test edilmiştir. Yapay zekâ özetinin gerçek LLM çıktısı üretebilmesi için tek gereken, `Claude:ApiKey` alanının doldurulmasıdır — kod tarafında ek bir değişiklik gerekmez. İsteğe bağlı olarak, gizlilik gerektiren toplantılar için `Summarization:Provider` ayarı `"ollama"` yapılarak transkriptin hiç dışarı çıkmadığı bir yerel LLM akışına da geçilebilir.
