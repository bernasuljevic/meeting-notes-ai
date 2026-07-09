// web/src/lib/audio.ts

/**
 * Tarayıcının doğal örnekleme hızından (genelde 48000 Hz),
 * Whisper'ın beklediği hıza (16000 Hz) düşürür.
 */
export function downsampleBuffer(
  buffer: Float32Array,
  sampleRate: number,
  outSampleRate: number
): Float32Array {
  if (outSampleRate === sampleRate) {
    return buffer;
  }

  const sampleRateRatio = sampleRate / outSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Birden fazla Float32Array parçasını tek bir Float32Array'de birleştirir.
 */
export function mergeBuffers(buffers: Float32Array[]): Float32Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Float32Array(totalLength);

  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

/**
 * Float32 ses örneklerini, 44 baytlık standart WAV header'ı ile
 * 16-bit PCM formatında bir Blob'a kodlar.
 */
export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk boyutu
  view.setUint16(20, 1, true); // PCM formatı
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Ham ses örneklerinden RMS (root-mean-square) değerini hesaplar.
 * Sessizlik eşiği (SILENCE_RMS) ile KARŞILAŞTIRMAK için bu ham değeri kullan.
 */
export function calculateRMS(samples: Float32Array): number {
  let sum = 0;

  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }

  return Math.sqrt(sum / samples.length);
}

/**
 * Canlı seviye göstergesi (LevelMeter) için 0-1 arasına ölçeklenmiş RMS.
 * Sessizlik eşiği karşılaştırması için DEĞİL, sadece görsel gösterim için kullan.
 */
export function calculateRMSLevel(samples: Float32Array): number {
  return Math.min(1, calculateRMS(samples) * 4);
}