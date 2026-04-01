type VoiceIndicatorProps = {
  isActive: boolean;
  isMuted?: boolean;
};

export function VoiceIndicator({ isActive, isMuted }: VoiceIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div
        className={`voice-wave ${!isActive || isMuted ? 'voice-wave--paused' : ''} scale-75 sm:scale-90 lg:scale-100 w-full`}
        aria-hidden="true"
      >
        {Array.from({ length: 20 }).map((_, index) => (
          <span key={index} style={{ animationDelay: `${index * 0.05}s` }} />
        ))}
      </div>
    </div>
  );
}
