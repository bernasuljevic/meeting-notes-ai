# Toplantı Notları (meeting-notes-ai)

Toplantı seslerini kaydedip gerçek zamanlı Türkçe transkript çıkaran, konuşma bitince yapay zekâ ile yapılandırılmış toplantı notları üreten ve tüm geçmişi kalıcı olarak saklayan bir uygulama.

Proje, ekip tarafından hazırlanan mimari döküman (`MIMARI_1.md`) referans alınarak geliştirilmiştir.

## Özellikler

- **Gerçek zamanlı ses kaydı ve transkripsiyon**: Tarayıcıda kaydedilen ses, küçük parçalara (chunk) bölünerek arka uca gönderilir; [Whisper.net](https://github.com/sandrohanea/whisper.net) ile cihaz üzerinde (on-device) Türkçe transkript üretilir. Herhangi bir ses verisi transkripsiyon için dışarı gönderilmez.
- **Çok kullanıcılı giriş sistemi**: Uygulamanın tamamı giriş yapmayı gerektirir (kayıt ol / giriş yap). Her kullanıcı sadece kendi kaydettiği toplantıları görür, listeler, siler ve dışa aktarır — toplantılar `Meeting.UserId` ile sahibine bağlıdır, başka bir kullanıcının toplantısına erişilemez.
- **Kişiye özel AI ayarları**: Yapay zekâ özellikleri (özetleme, toplantı sohbeti) sunucu genelinde sabit bir sağlayıcıya bağlı değildir. Her kullanıcı, giriş yaptıktan sonra "AI Ayarları" ekranından kendi sağlayıcısını (`claude` ya da `ollama`), modelini ve (Claude için) kendi API token'ını girer; token şifreli olarak saklanır ve backend hiçbir zaman geri döndürmez.
- **Yapay zekâ destekli toplantı özeti**: Toplantı bitince transkript, kullanıcının kendi AI ayarına göre 5 bölümden oluşan yapılandırılmış bir özet üretilir: Genel Özet, Kararlar, Aksiyon Maddeleri, Açık Konular ve Riskler, Önemli Tartışma Noktaları. Giriş yapılmamışsa ya da AI ayarı tamamlanmamışsa özet adımı atlanır, toplantı yine de sadece transkriptle kaydedilir — uygulama hiçbir zaman çökmez.
- **Toplantıyla soru-cevap sohbeti**: Kayıtlı bir toplantının transkripti hakkında serbest metin soru sorulabilir (`MeetingChat`); yanıt, kullanıcının kendi AI ayarıyla üretilir.
- **Word/PDF olarak dışa aktarma**: Toplantı detayından, transkript + AI özeti tek tıkla `.docx` ya da `.pdf` olarak indirilebilir.
- **Toplantı geçmişinde arama/sıralama/filtreleme**: Başlığa göre arama, en yeni/en eski/alfabetik sıralama, bugün/bu hafta/bu ay tarih filtresi.
- **Kalıcı depolama**: Toplantılar, transkript parçaları ve notlar EF Core + MSSQL ile veritabanında saklanır; geçmiş toplantılar listelenip tek tek detaylarına girilebilir.
- **Modern arayüz**: React + Vite + TypeScript + Tailwind + shadcn/ui ile geliştirilmiş; canlı seviye göstergesi (level meter), kayıt süresi sayacı, koyu tema (dark mode) ve toast bildirimleri içerir.
- **KVKK bilgilendirmesi**: Kayıt ekranında katılımcıları bilgilendirmek için kişisel verilerin işlenmesi hakkında bir uyarı notu bulunur.

## Mimari dökümandan bilinçli sapma

`MIMARI_1.md`'de öngörülen tamamen yerel (on-prem) LLM entegrasyonu yerine, ekip yönlendirmesiyle özetleme için varsayılan olarak **Anthropic Claude API**'si desteklenmiştir. Bu, kullanıcı Claude'u seçtiğinde transkript metninin özet/sohbet amacıyla Claude API'ye gönderildiği anlamına gelir (ham ses verisi hiçbir zaman cihaz dışına çıkmaz). Bu yüzden Recorder arayüzüne bir KVKK bilgilendirme notu eklenmiştir.

Bu gizlilik notunu esnetmek için özetleme tek bir sağlayıcıya kilitlenmemiştir: her kullanıcı kendi AI ayarından Claude yerine [Ollama](https://ollama.com) ile yerelde çalışan bir LLM'i seçebilir. Böylece hassas olmayan toplantılarda Claude tercih edilirken, hassas/maskelenmesi gereken toplantılarda transkript hiç dışarı çıkmadan yerel modelle özetlenebilir/sohbet edilebilir.

## AI sağlayıcısını yapılandırma (kullanıcı bazlı)

Özetleme ve toplantı sohbeti artık **sunucu genelinde sabit bir ayar değil** — her kullanıcı giriş yaptıktan sonra sağ üstteki "AI Ayarları" düğmesinden kendi tercihini girer:

| Alan | Açıklama |
| --- | --- |
| Sağlayıcı | `claude` ya da `ollama` (şu an desteklenen tek iki değer, büyük/küçük harf duyarsız) |
| Model | Örn. `claude-opus-4-20250514` (Claude) ya da `llama3.1` (Ollama) |
| API Token | Sadece `claude` için gerekli (`sk-ant-...`); şifreli saklanır, dialog her açıldığında boş görünür — boş bırakırsan mevcut token değişmez. Ollama yerelde çalıştığı için token istemez. |

Bu ayar tamamlanmadan `POST /api/summarize` ve `POST /api/meetings/{id}/chat` çağrıları 400 döner ("Önce AI ayarlarından bir sağlayıcı, model ve API token belirlemelisin"); frontend bu durumda özetleme adımını sessizce atlar (`aiSkipped`), toplantı yine transkriptle kaydedilir.

`ollama` seçilirse istekler, backend'in `appsettings.json` içindeki `Ollama:BaseUrl` adresine gider (varsayılan `http://localhost:11434/`) — yani Ollama'nın kendisi sunucu tarafında kurulu ve çalışır olmalı (`ollama pull <model>` + `ollama serve`), kullanıcı sadece model adını seçer.

> **Not:** `appsettings.json`'daki `Claude:ApiKey` ve `Summarization:Provider` alanları eski (tek kullanıcılı) tasarımdan kalma olup artık gerçek özetleme/sohbet akışını etkilemez — her kullanıcı kendi token'ını girer. Bu alanları boş bırakabilirsin.

## Teknoloji yığını

**Backend (`api/`)**
- .NET 10 Minimal API
- Entity Framework Core + MSSQL
- Whisper.net (Türkçe konuşma tanıma)
- JWT Bearer kimlik doğrulama (çok kullanıcılı giriş)
- ASP.NET Core Data Protection (kullanıcının AI API token'ını şifreli saklamak için)
- Anthropic Claude Messages API + Ollama (kullanıcı bazlı özetleme/sohbet sağlayıcıları)
- DocumentFormat.OpenXml (Word/.docx dışa aktarma), QuestPDF (PDF dışa aktarma)

**Frontend (`web/`)**
- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui + radix-ui, next-themes (dark mode)
- Web Audio API (ses yakalama ve chunk'lama)
- react-markdown (AI özetini/toplantı notlarını render etmek için)
- sonner (toast bildirimleri)

## Kurulum

### Gereksinimler

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (18+)
- SQL Server (LocalDB / Express yeterlidir)
- (Opsiyonel) [Ollama](https://ollama.com/download) — yerel LLM sağlayıcısını kullanmak isteyenler için

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
- `Ollama:BaseUrl` / `Ollama:Model` — sadece kullanıcılar AI ayarlarında "ollama" seçecekse gerekli; varsayılan `http://localhost:11434/` yeterli.
- `Claude:ApiKey`, `Summarization:Provider` — artık kullanılmıyor, dokunmanıza gerek yok (bkz. yukarıdaki "AI sağlayıcısını yapılandırma" notu).

**`Jwt:Secret` mutlaka ayarlanmalı** — boş bırakılırsa uygulama açılışta hata verip kapanır (JWT token'larını imzalamak için kullanılır). `appsettings.json`'a düz yazmak yerine User Secrets kullanılması önerilir:

```bash
cd api
dotnet user-secrets set "Jwt:Secret" "en-az-32-karakterlik-rastgele-bir-metin"
```

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

### 6. Bir hesap oluşturun

Uygulamada varsayılan/önceden oluşturulmuş bir kullanıcı **yoktur**. Açılış ekranındaki "Kayıt Ol" sekmesinden kendi kullanıcı adını (en az 3 karakter) ve şifreni (en az 6 karakter) girerek bir hesap oluşturman gerekir; kayıt olur olmaz otomatik giriş yapılır.

## Durum

Uygulamanın kayıt, transkripsiyon, kalıcı saklama, çok kullanıcılı giriş, toplantı sahiplik/yetkilendirme, kişiye özel AI ayarları ve arayüz kısımları tamamlanmış ve test edilmiştir. Her toplantı, oluşturan kullanıcıya bağlıdır; toplantı listesi/detayı/silme/dışa aktarma uçlarının tamamı giriş yapmayı ve sahiplik kontrolünü zorunlu kılar.

Yapay zekâ özelliklerini kullanabilmek için tek gereken, giriş yaptıktan sonra "AI Ayarları" ekranından bir sağlayıcı (Claude ya da Ollama), model ve (Claude için) kendi API token'ını girmektir — kod tarafında ek bir değişiklik gerekmez.
