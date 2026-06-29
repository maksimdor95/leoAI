import { CommandItem } from '@/types/chat';
import { useHumeTheme } from '@/lib/useHumeTheme';

type CommandBarProps = {
  commands?: CommandItem[];
  loading?: boolean;
  onSelect: (command: CommandItem) => void;
};

export function CommandBar({ commands, loading, onSelect }: CommandBarProps) {
  const isHume = useHumeTheme();

  if (!commands || commands.length === 0) {
    return null;
  }

  return (
    <div className="leo-chat-stage flex flex-wrap gap-2">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          onClick={() => onSelect(command)}
          disabled={loading}
          className={
            isHume
              ? 'rounded-full border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[rgba(34,34,34,0.18)] hover:bg-[var(--color-bone)] disabled:cursor-not-allowed disabled:opacity-50'
              : 'rounded-full border border-green-500/25 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-200 transition-colors hover:border-green-400/40 hover:bg-green-500/15 hover:text-green-100 disabled:cursor-not-allowed disabled:opacity-50'
          }
        >
          {command.icon && <span className="mr-2">{command.icon}</span>}
          {command.label}
        </button>
      ))}
    </div>
  );
}
