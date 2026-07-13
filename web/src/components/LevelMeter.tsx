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
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Ses Seviyesi
        </span>

        <span
          className={`text-sm font-semibold ${
            isRecording
              ? "text-red-600 dark:text-red-400"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {isRecording ? "Kayıt Yapılıyor" : "Hazır"}
        </span>
      </div>

      <div className="h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-75 ${
            isRecording
              ? "bg-gradient-to-r from-emerald-500 via-lime-400 to-red-500"
              : "bg-slate-400 dark:bg-slate-500"
          }`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}
