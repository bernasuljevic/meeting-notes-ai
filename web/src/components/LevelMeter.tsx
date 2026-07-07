interface LevelMeterProps {
  level: number;
  isRecording: boolean;
}

export function LevelMeter({
  level,
  isRecording,
}: LevelMeterProps) {
  if (!isRecording) {
    return null;
  }

  return (
    <div className="w-64 h-3 bg-gray-200 rounded overflow-hidden">
      <div
        className="h-full bg-green-500 transition-all duration-75"
        style={{
          width: `${level * 100}%`,
        }}
      />
    </div>
  );
}