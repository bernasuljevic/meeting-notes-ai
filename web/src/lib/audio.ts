// web/src/lib/audio.ts

/**
 * Ham ses verisini verilen giriş örnekleme hızından
 * hedef örnekleme hızına düşürür (downsample).
 * Örnek: 48000 Hz -> 16000 Hz
 */
export function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array {
  if (outputSampleRate === inputSampleRate) {
    return buffer;
  }

  if (outputSampleRate > inputSampleRate) {
    throw new Error(
      "Hedef örnekleme hızı giriş örnekleme hızından büyük olamaz."
    );
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round(
      (offsetResult + 1) * sampleRateRatio
    );

    let accum = 0;
    let count = 0;

    for (
      let i = offsetBuffer;
      i < nextOffsetBuffer && i < buffer.length;
      i++
    ) {
      accum += buffer[i];
      count++;
    }

    result[offsetResult] =
      count > 0 ? accum / count : 0;

    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Birden fazla Float32Array parçasını
 * tek bir büyük diziye birleştirir.
 */
export function mergeBuffers(
  buffers: Float32Array[]
): Float32Array {
  let totalLength = 0;

  for (const buffer of buffers) {
    totalLength += buffer.length;
  }

  const result = new Float32Array(totalLength);

  let offset = 0;

  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

/**
 * Ham ses örneklerinden anlık ses seviyesini hesaplar.
 * Sonuç 0 ile 1 arasındadır.
 */
export function calculateRMSLevel(
  samples: Float32Array
): number {
  let sum = 0;

  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sum / samples.length);

  // UI'da daha görünür olması için büyütüyoruz
  return Math.min(1, rms * 4);
}

function writeString(
  view: DataView,
  offset: number,
  str: string
): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(
      offset + i,
      str.charCodeAt(i)
    );
  }
}

function floatTo16BitPCM(
  view: DataView,
  offset: number,
  input: Float32Array
): void {
  for (
    let i = 0;
    i < input.length;
    i++, offset += 2
  ) {
    const s = Math.max(
      -1,
      Math.min(1, input[i])
    );

    view.setInt16(
      offset,
      s < 0 ? s * 0x8000 : s * 0x7fff,
      true
    );
  }
}

/**
 * Float32 mono sesi
 * standart 16-bit PCM WAV dosyasına dönüştürür.
 */
export function encodeWAV(
  samples: Float32Array,
  sampleRate: number
): Blob {
  const bytesPerSample = 2;
  const numChannels = 1;

  const buffer = new ArrayBuffer(
    44 + samples.length * bytesPerSample
  );

  const view = new DataView(buffer);

  // RIFF
  writeString(view, 0, "RIFF");
  view.setUint32(
    4,
    36 + samples.length * bytesPerSample,
    true
  );
  writeString(view, 8, "WAVE");

  // fmt
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(
    28,
    sampleRate *
      numChannels *
      bytesPerSample,
    true
  );
  view.setUint16(
    32,
    numChannels * bytesPerSample,
    true
  );
  view.setUint16(34, 16, true);

  // data
  writeString(view, 36, "data");
  view.setUint32(
    40,
    samples.length * bytesPerSample,
    true
  );

  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], {
    type: "audio/wav",
  });
}