namespace api.Options;

public class OllamaOptions
{
    public const string SectionName = "Ollama";

    public string BaseUrl { get; set; } = "http://localhost:11434/";

    public string Model { get; set; } = "llama3.1";

    // Ollama'ya her istekte açıkça geçilen context penceresi (token). Varsayılan
    // Ollama davranışı modelden modele değişir ve çoğu zaman 2048-4096 token gibi
    // dar bir pencereyle sınırlıdır; uzun toplantı transkriptlerinde bu, transkriptin
    // sessizce kırpılmasına yol açabilir. Burada açıkça daha geniş bir pencere
    // istiyoruz (modelin/donanımın desteklediği ölçüde).
    public int NumCtx { get; set; } = 8192;

    // Bu karakter sayısının altındaki transkriptler tek seferde (mevcut davranış)
    // özetlenir. Üzerindekiler MapReduce (parçalı) özetlemeye geçer — bkz.
    // OllamaSummarizationService.SummarizeAsync.
    public int MaxDirectCharacters { get; set; } = 20000;

    // MapReduce'a geçildiğinde her parçanın hedef karakter boyutu.
    public int ChunkCharacters { get; set; } = 12000;
}
