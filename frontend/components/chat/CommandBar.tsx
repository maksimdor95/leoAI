'use client';

import { CommandItem } from '@/types/chat';
import {
  INTERVIEW_PREP_MODE_LABELS,
  parseInterviewModeFromAction,
} from '@/lib/interviewPrepModes';
import { useHumeTheme } from '@/lib/useHumeTheme';

type CommandBarProps = {
  commands?: CommandItem[];
  loading?: boolean;
  onSelect: (command: CommandItem) => void;
};

function commandDisplayLabel(command: CommandItem): string {
  const mode = parseInterviewModeFromAction(command.action);
  if (mode) {
    return INTERVIEW_PREP_MODE_LABELS[mode];
  }
  return command.label;
}

export function CommandBar({ commands, loading, onSelect }: CommandBarProps) {
  const isHume = useHumeTheme();

  if (!commands || commands.length === 0) {
    return null;
  }

  return (
    <div className="leo-chat-stage flex flex-wrap gap-1.5 sm:gap-2">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          onClick={() => onSelect(command)}
          disabled={loading}
          className={
            isHume
              ? 'rounded-full border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[rgba(34,34,34,0.18)] hover:bg-[var(--color-bone)] disabled:cursor-not-allowed disabled:opacity-50'
              : 'rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-200 transition-colors hover:border-green-400/40 hover:bg-green-500/15 hover:text-green-100 disabled:cursor-not-allowed disabled:opacity-50'
          }
        >
          {command.icon && <span className="mr-1.5">{command.icon}</span>}
          {commandDisplayLabel(command)}
        </button>
      ))}
    </div>
  );
}
