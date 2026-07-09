interface LevelMeterProps {
  level: number;
  isRecording: boolean;
}

export function LevelMeter({
  level,
  isRecording,
}: LevelMeterProps) {
  const percentage = Math.min(
    100,
    Math.max(0, level * 100)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          Ses Seviyesi
        </span>

        <span
          className={`text-sm font-semibold ${
            isRecording
              ? "text-red-600"
              : "text-slate-500"
          }`}
        >
          {isRecording ? "Kayıt Yapılıyor" : "Hazır"}
        </span>
      </div>

      <div className="h-4 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-75 ${
            isRecording
              ? "bg-gradient-to-r from-emerald-500 via-lime-400 to-red-500"
              : "bg-slate-400"
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}