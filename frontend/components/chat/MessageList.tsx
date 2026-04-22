import {
  Message,
  MessageRole,
  MessageType,
  InfoCardMessage,
  CommandItem,
  CommandMessage,
} from '@/types/chat';
import { Button } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

function getMessageContent(message: Message): string {
  if (message.type === MessageType.TEXT || message.type === MessageType.SYSTEM) {
    return message.content;
  }

  if (message.type === MessageType.QUESTION) {
    return message.question;
  }

  if (message.type === MessageType.INFO_CARD) {
    return `${message.title}${message.description ? ` — ${message.description}` : ''}`;
  }

  if (message.type === MessageType.COMMAND) {
    return message.commands.map((command) => `• ${command.label}`).join('\n');
  }

  return '';
}

type MessageListProps = {
  messages: Message[];
  onShowProfile?: (profileData: InfoCardMessage) => void;
  onCommandSelect?: (command: CommandItem) => void;
};

export function MessageList({ messages, onShowProfile, onCommandSelect }: MessageListProps) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => {
        const content = getMessageContent(message);
        if (!content) {
          return null;
        }

        const isAssistant =
          message.role === MessageRole.ASSISTANT || message.role === MessageRole.SYSTEM;

        const isProfileCard =
          message.type === MessageType.INFO_CARD &&
          (message as InfoCardMessage).title === 'Ваш профиль';

        return (
          <div
            key={message.id}
            className={`flex gap-2 ${isAssistant ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[240px] rounded-2xl px-3 py-2 shadow-sm backdrop-blur break-words overflow-wrap-anywhere ${
                isAssistant
                  ? 'bg-white/10 text-slate-100 border border-white/10 rounded-tl-sm'
                  : 'bg-blue-500/20 text-slate-100 border border-blue-400/30 rounded-tr-sm'
              }`}
            >
              <div className="mb-1 text-[8px] uppercase tracking-[0.3em] text-slate-400 opacity-70">
                {isAssistant ? 'LEO' : ''}
              </div>
              {message.type === MessageType.COMMAND ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {(message as CommandMessage).commands.map((command) => (
                    <Button
                      key={`${message.id}-${command.id}`}
                      type="default"
                      size="small"
                      onClick={() => onCommandSelect?.(command)}
                      className="!h-7 !rounded-full !border-white/20 !bg-white/5 !px-3 !text-[11px] !text-slate-100 hover:!border-green-400/60 hover:!text-green-200"
                    >
                      {command.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="whitespace-pre-line text-[11px] leading-relaxed break-words hyphens-auto">
                  {content}
                </div>
              )}
              {isProfileCard && onShowProfile && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => onShowProfile(message as InfoCardMessage)}
                    className="!text-green-300 !text-[10px] !h-6 !px-2 hover:!bg-green-500/20 !border-0"
                  >
                    Показать профиль
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
