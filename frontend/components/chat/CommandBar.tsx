import { CommandItem } from '@/types/chat';

type CommandBarProps = {
  commands?: CommandItem[];
  loading?: boolean;
  onSelect: (command: CommandItem) => void;
};

export function CommandBar({ commands, loading, onSelect }: CommandBarProps) {
  if (!commands || commands.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          onClick={() => onSelect(command)}
          disabled={loading}
          className="rounded-full border border-green-400/60 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-100 transition hover:bg-green-400/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {command.icon && <span className="mr-2">{command.icon}</span>}
          {command.label}
        </button>
      ))}
    </div>
  );
}
