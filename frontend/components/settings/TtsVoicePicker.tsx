'use client';

type TtsVoicePickerProps = {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
};

export function TtsVoicePicker({ value, options, onChange, ariaLabel }: TtsVoicePickerProps) {
  return (
    <div className="app-settings-voice-list" role="listbox" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={selected}
            className={
              selected
                ? 'app-settings-voice-option app-settings-voice-option--selected'
                : 'app-settings-voice-option'
            }
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
