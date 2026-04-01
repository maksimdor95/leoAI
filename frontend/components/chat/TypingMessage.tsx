import { useEffect, useMemo, useState } from 'react';
import { Message } from '@/types/chat';

type TypingMessageProps = {
  message?: Message;
  typingSpeed?: number; // ms per character
  delay?: number; // initial delay before typing starts
  onComplete?: () => void;
};

/**
 * Renders a message with typing animation.
 */
export function TypingMessage({
  message,
  typingSpeed = 50,
  delay = 0,
  onComplete,
}: TypingMessageProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const targetText = useMemo(() => {
    if (!message) {
      return '';
    }

    if ('content' in message && typeof message.content === 'string') {
      return message.content;
    }

    if ('question' in message && typeof message.question === 'string') {
      return message.question;
    }

    return '';
  }, [message]);

  useEffect(() => {
    if (!targetText) {
      setDisplayedText('');
      return;
    }

    setDisplayedText('');
    setIsTyping(true);
    setIsComplete(false);

    const timeout = setTimeout(() => {
      let index = 0;

      const interval = setInterval(() => {
        index += 1;
        setDisplayedText(targetText.slice(0, index));

        if (index >= targetText.length) {
          clearInterval(interval);
          setIsTyping(false);
          setIsComplete(true);
          setTimeout(() => {
            onComplete?.();
          }, 300);
        }
      }, typingSpeed);

      return () => {
        clearInterval(interval);
      };
    }, delay);

    return () => {
      clearTimeout(timeout);
    };
  }, [targetText, typingSpeed, delay, onComplete]);

  if (!message || !targetText) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-lg backdrop-blur transition-opacity duration-500 max-w-[680px] ${
        isComplete ? 'opacity-100 animate-fadeIn' : 'opacity-100'
      }`}
    >
      <div className="mb-1 text-[8px] uppercase tracking-[0.35em] text-slate-400 text-left">
        LEO
      </div>
      <div className="text-xs leading-relaxed text-slate-100 whitespace-pre-line break-words hyphens-auto overflow-wrap-anywhere text-left">
        {displayedText}
        {isTyping && <span className="ml-1 animate-pulse">▍</span>}
      </div>
    </div>
  );
}
