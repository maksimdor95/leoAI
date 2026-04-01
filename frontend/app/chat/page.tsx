'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  Button,
  Empty,
  Form,
  Input,
  Layout,
  Spin,
  Typography,
  message as antdMessage,
  Modal,
  Tooltip,
} from 'antd';
import {
  CommandItem,
  CommandMessage,
  InfoCardMessage,
  Message,
  MessageRole,
  MessageType,
  MessageTypeValue,
  QuestionMessage,
} from '@/types/chat';
import { createChatApi, ChatApi } from '@/lib/chatApi';
import { getToken, isAuthenticated, removeToken } from '@/lib/auth';
import { MessageList } from '@/components/chat/MessageList';
import { VoiceIndicator } from '@/components/chat/VoiceIndicator';
import { StagePanel } from '@/components/chat/StagePanel';
import { TypingMessage } from '@/components/chat/TypingMessage';
import { ProfileModal } from '@/components/chat/ProfileModal';
import { ProductSelectionScreen, ProductType } from '@/components/chat/ProductSelectionScreen';
import {
  SoundOutlined,
  AudioMutedOutlined,
  SendOutlined,
  AudioOutlined,
} from '@ant-design/icons';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const { Title, Text } = Typography;
const { Content } = Layout;

type MessageFormValues = {
  message: string;
};

function extractLatest<T extends Message>(
  messages: Message[],
  type: MessageTypeValue
): T | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.type === type) {
      return msg as T;
    }
  }
  return undefined;
}

function shouldAnimateMessage(message: Message, existingMessages: Message[]): boolean {
  if (message.role !== MessageRole.ASSISTANT) {
    return false;
  }

  if (message.type !== MessageType.QUESTION) {
    return false;
  }

  // Если сообщение уже есть в истории, повторно не анимируем
  return !existingMessages.some((existing) => existing.id === message.id);
}

function dedupeAndSortMessages(messages: Message[]): Message[] {
  const map = new Map<string, Message>();

  for (const message of messages) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function appendMessage(messages: Message[], message: Message): Message[] {
  if (messages.some((existing) => existing.id === message.id)) {
    return messages;
  }

  return dedupeAndSortMessages([...messages, message]);
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuth();
  const [form] = Form.useForm<MessageFormValues>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [messageApi, contextHolder] = antdMessage.useMessage();
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<ChatApi | null>(null);
  const chatInitializedRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [typingMessage, setTypingMessage] = useState<Message | null>(null);
  const [typingOptions, setTypingOptions] = useState<{ speed: number; delay: number }>({
    speed: 50,
    delay: 1200,
  });
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState<InfoCardMessage | null>(null);
  const profileModalOpenRef = useRef(false);
  const [inputText, setInputText] = useState('');
  const finalTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const [currentProduct, setCurrentProduct] = useState<ProductType>('jack');
  const [productSelected, setProductSelected] = useState(false);
  const [isNewChatMode, setIsNewChatMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'ru-RU';
        recognitionInstance.maxAlternatives = 1;

        recognitionInstance.onresult = (event: any) => {
          if (!event?.results?.length) return;

          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const item = result?.[0];
            const raw = typeof item?.transcript === 'string' ? item.transcript : '';
            const transcript = raw.replace(/\s+/g, ' ').trim();
            if (!transcript) continue;

            if (result.isFinal) {
              finalTranscriptRef.current += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          const fullTranscript = (finalTranscriptRef.current + interimTranscript)
            .replace(/\s+/g, ' ')
            .trim();

          if (fullTranscript) {
            setInputText(fullTranscript);
            form.setFieldsValue({ message: fullTranscript });
          }
        };

        recognitionInstance.onend = () => {
          const finalText = finalTranscriptRef.current.replace(/\s+/g, ' ').trim();
          if (finalText) {
            setInputText(finalText);
            form.setFieldsValue({ message: finalText });
          }
          
          // Если пользователь все еще хочет слушать, перезапускаем распознавание
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              // Если не удалось перезапустить, останавливаем
              console.error('Failed to restart recognition:', err);
              setIsListening(false);
              isListeningRef.current = false;
            }
          } else {
            setIsListening(false);
          }
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          isListeningRef.current = false;
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            messageApi.error(`Ошибка распознавания речи: ${event.error}`);
          }
        };

        recognitionInstance.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
          // Сбрасываем накопленный текст при новом старте
          finalTranscriptRef.current = '';
        };

        recognitionRef.current = recognitionInstance;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [form, messageApi]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      messageApi.warning('Ваш браузер не поддерживает распознавание речи');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      try {
        // Сбрасываем накопленный текст перед новым стартом
        finalTranscriptRef.current = '';
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  }, [isListening, messageApi]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || isMuted || !text?.trim()) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'ru-RU';
      utterance.rate = 1.25; // быстрее обычного (~25%)

      const voices = window.speechSynthesis.getVoices();
      const ruVoice = voices.find((v) => v.lang.includes('ru') || v.lang.includes('RU'));
      if (ruVoice) utterance.voice = ruVoice;

      window.speechSynthesis.speak(utterance);
    },
    [isMuted]
  );

  // Останавливаем звук при мьюте
  useEffect(() => {
    if (isMuted) {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    }
  }, [isMuted]);

  const handleShowProfile = useCallback((data: InfoCardMessage) => {
    // Open modal with data from history (may be outdated)
    setProfileData(data);
    setProfileModalOpen(true);
    profileModalOpenRef.current = true;

    // Request fresh profile data from backend
    if (chatRef.current) {
      chatRef.current.sendMessage('покажи мой профиль');
    }
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setProfileModalOpen(false);
    profileModalOpenRef.current = false;
    setProfileData(null);
  }, []);

  // Function to initialize chat with a specific product
  const initializeChat = useCallback((product: ProductType, sessionIdParam?: string, isNew?: boolean) => {
    // Disconnect previous chat if exists
    if (chatRef.current) {
      chatRef.current.disconnect();
      chatRef.current = null;
      chatInitializedRef.current = false;
    }

    setConnecting(true);
    setError(null);
    setMessages([]);
    setSessionId(null);
    setCurrentProduct(product);
    setProductSelected(true);

    try {
      const chat = createChatApi({
        token: getToken() ?? undefined,
        sessionId: sessionIdParam ?? undefined,
        createNew: isNew ?? true,
        product: isNew ? product : undefined,
        onConnected: () => {
          setConnected(true);
          setConnecting(false);
          setError(null);
        },
        onDisconnected: () => {
          setConnected(false);
          setConnecting(true);
        },
        onSessionJoined: (payload) => {
          setSessionId(payload.sessionId);
          if (payload.metadata?.product) {
            setCurrentProduct(payload.metadata.product);
          }
          // Clean URL after session is joined
          router.replace('/chat', { scroll: false });
        },
        onHistory: (payload) => {
          const sortedMessages = dedupeAndSortMessages(payload.messages);

          const hasUserMessages = sortedMessages.some((msg) => msg.role === MessageRole.USER);

          if (!hasUserMessages) {
            const firstAssistantQuestion = sortedMessages.find(
              (msg) => msg.role === MessageRole.ASSISTANT && msg.type === MessageType.QUESTION
            );

            if (firstAssistantQuestion) {
              setTypingMessage(firstAssistantQuestion);
              setTypingOptions({ speed: 50, delay: 1200 });
              setIsTyping(true);

              speak((firstAssistantQuestion as QuestionMessage).question);

              const withoutIntro = sortedMessages.filter(
                (msg) => msg.id !== firstAssistantQuestion.id
              );
              setMessages(dedupeAndSortMessages(withoutIntro));
              return;
            }
          }

          setMessages(dedupeAndSortMessages(sortedMessages));
        },
        onMessage: (payload) => {
          if (
            profileModalOpenRef.current &&
            payload.message.type === MessageType.INFO_CARD &&
            (payload.message as InfoCardMessage).title === 'Ваш профиль'
          ) {
            setProfileData(payload.message as InfoCardMessage);
          }

          setMessages((prev) => {
            if (shouldAnimateMessage(payload.message, prev)) {
              setTypingMessage(payload.message);
              setTypingOptions({ speed: 50, delay: 700 });
              setIsTyping(true);

              if (payload.message.type === MessageType.QUESTION) {
                speak((payload.message as QuestionMessage).question);
              }

              return prev;
            }

            return appendMessage(prev, payload.message);
          });
        },
        onError: (payload) => {
          setError(payload.message);
          setConnecting(false);
          messageApi.error(payload.message);
        },
      });

      chatRef.current = chat;
      chat.connect();
      chatInitializedRef.current = true;
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Не удалось подключиться к чату';
      setError(messageText);
      setConnecting(false);
      messageApi.error(messageText);
    }
  }, [messageApi, router, speak]);

  useEffect(() => {
    if (!isAuthenticated()) {
      messageApi.warning('Авторизуйтесь, чтобы продолжить диалог с LEO.');
      openAuthModal('login');
      router.push('/');
      return;
    }

    const isNewChat = searchParams.get('new') === 'true';
    const requestedSessionId = isNewChat ? null : searchParams.get('sessionId');
    const requestedProduct = searchParams.get('product') as ProductType | null;

    // If it's a new chat without a pre-selected product, show product selection screen
    if (isNewChat && !requestedProduct) {
      setIsNewChatMode(true);
      setProductSelected(false);
      setConnecting(false);
      return;
    }

    // If resuming an existing session or product is pre-selected
    if (requestedSessionId || requestedProduct) {
      const product = requestedProduct || 'jack';
      initializeChat(product, requestedSessionId ?? undefined, isNewChat);
    } else {
      // Default: show product selection for new users
      setIsNewChatMode(true);
      setProductSelected(false);
      setConnecting(false);
    }

    return () => {
      chatRef.current?.disconnect();
      chatRef.current = null;
      chatInitializedRef.current = false;
    };
  }, [messageApi, router, searchParams, openAuthModal, initializeChat]);

  // Handler for product selection
  const handleProductSelect = useCallback((product: ProductType) => {
    setIsNewChatMode(false);
    initializeChat(product, undefined, true);
  }, [initializeChat]);

  const handleTypingComplete = useCallback(() => {
    setTypingMessage((current) => {
      if (current) {
        setMessages((prev) => appendMessage(prev, current));
      }
      setIsTyping(false);
      return null;
    });
  }, []);

  const handleSend = (values: MessageFormValues) => {
    if (!chatRef.current) {
      return;
    }

    const messageText = values.message || inputText;
    if (!messageText.trim()) {
      return;
    }

    // Останавливаем распознавание, если оно активно
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
    }

    chatRef.current.sendMessage(messageText);
    form.resetFields();
    setInputText('');
    finalTranscriptRef.current = '';
  };

  const handleCommandSelect = async (command: CommandItem) => {
    if (!chatRef.current) {
      return;
    }

    // Special handling for download_report action
    if (command.action === 'download_report') {
      try {
        messageApi.loading({ content: 'Генерируем отчёт...', key: 'report', duration: 0 });
        
        const result = await chatRef.current.requestReport();
        
        if (result.url) {
          messageApi.success({ content: 'Отчёт готов! Скачивание...', key: 'report' });
          // Open download URL in new tab
          window.open(result.url, '_blank');
        } else {
          messageApi.error({ content: 'Отчёт ещё не готов. Попробуйте позже.', key: 'report' });
        }
      } catch (error) {
        messageApi.error({ 
          content: error instanceof Error ? error.message : 'Ошибка генерации отчёта', 
          key: 'report' 
        });
      }
      return;
    }

    // Default command handling
    chatRef.current.executeCommand(command.id, command.action);
  };

  const latestQuestion = useMemo(
    () => extractLatest<QuestionMessage>(messages, MessageType.QUESTION),
    [messages]
  );

  const latestInfoCard = useMemo(
    () => extractLatest<InfoCardMessage>(messages, MessageType.INFO_CARD),
    [messages]
  );

  const latestCommand = useMemo(
    () => extractLatest<CommandMessage>(messages, MessageType.COMMAND),
    [messages]
  );

  const handleStartHiring = () => {
    messageApi.info('Скоро добавим переход к поиску вакансий.');
  };

  const handleLogout = () => {
    Modal.confirm({
      title: 'Выход из аккаунта',
      content: 'Вы уверены, что хотите выйти?',
      okText: 'Выйти',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => {
        // Remove token
        removeToken();
        // Disconnect chat
        chatRef.current?.disconnect();
        // Redirect to home
        router.push('/');
        messageApi.success('Вы успешно вышли из аккаунта');
      },
    });
  };

  return (
    <Layout className="min-h-screen bg-[#050913] text-white">
      {contextHolder}
      <Content className="flex flex-col h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex h-full max-w-[1200px] flex-col gap-3 sm:gap-4 lg:gap-5 overflow-hidden">
          <header className="flex-shrink-0 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Title
                level={2}
                style={{ color: 'white', marginBottom: 0 }}
                className="text-lg sm:text-xl lg:text-2xl"
              >
                {!productSelected && isNewChatMode
                  ? 'Новый чат'
                  : currentProduct === 'wannanew'
                    ? 'Чат с wannanew'
                    : 'Чат с LEO'}
              </Title>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/chats">
                <Button type="text" size="small" className="!text-slate-200 text-xs sm:text-sm">
                  <span className="hidden sm:inline">Мои чаты</span>
                  <span className="sm:hidden">Чаты</span>
                </Button>
              </Link>
              <Tooltip title="Выйти из аккаунта">
                <Button
                  type="text"
                  size="small"
                  onClick={handleLogout}
                  className="!text-slate-200 hover:!text-red-400 text-xs sm:text-sm"
                >
                  Выйти
                </Button>
              </Tooltip>
            </div>
          </header>

          <div className={`grid gap-3 h-full overflow-hidden min-h-0 ${
            !productSelected && isNewChatMode
              ? 'grid-cols-1'
              : 'grid-cols-1 lg:grid-cols-[minmax(500px,1fr)_320px]'
          }`}>
            <section className="flex flex-col gap-3 sm:gap-4 lg:gap-5 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 lg:p-5 backdrop-blur overflow-auto max-h-[85vh]">
              {/* Show product selection screen for new chats */}
              {!productSelected && isNewChatMode ? (
                <div className="flex-1 flex items-center justify-center">
                  <ProductSelectionScreen onSelect={handleProductSelect} />
                </div>
              ) : (
                <>
                  <div className="flex-shrink-0">
                    <VoiceIndicator
                      isActive={(connected && !isMuted) || isListening}
                      isMuted={isMuted && !isListening}
                    />
                  </div>

                  <div className="flex-1 overflow-auto flex items-start justify-center min-h-0 py-2 sm:py-3">
                    {connecting ? (
                      <div className="flex flex-col items-center justify-center gap-4">
                        <Spin size="large" />
                        <Text style={{ color: 'rgba(226, 232, 240, 0.85)' }}>
                          {currentProduct === 'wannanew' ? 'Подключаемся к wannanew...' : 'Подключаемся к LEO...'}
                        </Text>
                      </div>
                    ) : isTyping && typingMessage ? (
                      <div className="flex flex-col items-start justify-center w-full">
                        <TypingMessage
                          message={typingMessage}
                          typingSpeed={typingOptions.speed}
                          delay={typingOptions.delay}
                          onComplete={handleTypingComplete}
                        />
                      </div>
                    ) : (
                      <div className="w-full flex items-start justify-center overflow-auto">
                        <StagePanel
                          question={latestQuestion}
                          infoCard={latestInfoCard}
                          commands={latestCommand?.commands}
                          onCommandSelect={handleCommandSelect}
                          onContinue={() => {
                            if (chatRef.current) {
                              chatRef.current.sendMessage('продолжить');
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Hide aside panel when in product selection mode */}
            {productSelected && (
              <aside className="flex flex-col rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 backdrop-blur w-full overflow-hidden">
                <div className="mb-2 sm:mb-4 text-xs uppercase tracking-[0.35em] text-slate-400 flex-shrink-0">
                  История диалога
                </div>
                <div className="custom-scrollbar overflow-y-auto pr-2">
                  {messages.length > 0 ? (
                    <MessageList messages={messages} onShowProfile={handleShowProfile} />
                  ) : connecting ? (
                    <div className="flex items-center justify-center py-8">
                      <Spin size="small" />
                    </div>
                  ) : (
                    <Empty description={<span className="text-slate-300">Пока нет сообщений</span>} />
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Hide footer when in product selection mode */}
          {productSelected && (
            <footer className="flex-shrink-0 mt-3 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-end">
              <Form form={form} onFinish={handleSend} className="flex-1">
                <Form.Item
                  name="message"
                  rules={[{ required: true, message: 'Введите сообщение LEO' }]}
                  style={{ marginBottom: 0 }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.04] px-2 sm:px-3 lg:px-4 py-2 sm:py-3 backdrop-blur">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Tooltip title={isMuted ? 'Включить звук' : 'Выключить звук'}>
                        <Button
                          type="text"
                          size="small"
                          icon={isMuted ? <AudioMutedOutlined /> : <SoundOutlined />}
                          onClick={() => setIsMuted((prev) => !prev)}
                          className="!text-white !p-1 sm:!p-2"
                        />
                      </Tooltip>
                      <Tooltip title={isListening ? 'Остановить запись' : 'Начать запись голоса'}>
                        <Button
                          type="text"
                          size="small"
                          icon={<AudioOutlined style={{ color: isListening ? '#22c55e' : 'white' }} />}
                          onClick={toggleListening}
                          className={`!p-1 sm:!p-2 ${isListening ? 'animate-pulse bg-green-500/20 rounded-full' : '!text-white'}`}
                        />
                      </Tooltip>
                    </div>
                    <div className="flex-1">
                      <Input.TextArea
                        value={inputText}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setInputText(newValue);
                          form.setFieldsValue({ message: newValue });
                        }}
                        placeholder={
                          isListening
                            ? 'Слушаю...'
                            : (latestQuestion?.placeholder ??
                              (currentProduct === 'wannanew' ? 'Напишите ответ или задайте вопрос...' : 'Напишите ответ или задайте вопрос LEO...'))
                        }
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={!connected}
                        variant="borderless"
                        className="!bg-transparent !text-white !placeholder:text-slate-500"
                        onPressEnter={(e) => {
                          if (!e.shiftKey) {
                            e.preventDefault();
                            form.submit();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      htmlType="submit"
                      icon={<SendOutlined />}
                      disabled={!connected}
                      className="flex items-center justify-center rounded-full border-none bg-green-500 px-2 sm:px-3 lg:px-4 py-1 sm:py-2 text-white shadow-lg hover:bg-green-400"
                    />
                  </div>
                </Form.Item>
              </Form>

              <Button
                type="primary"
                size="small"
                onClick={handleStartHiring}
                className="h-8 sm:h-10 lg:h-12 rounded-full border-none bg-green-500 px-3 sm:px-4 lg:px-6 text-xs sm:text-sm font-semibold text-white shadow-xl hover:bg-green-400"
              >
                <span className="hidden sm:inline">Поиск</span>
                <span className="sm:hidden">Поиск</span>
              </Button>
            </footer>
          )}
        </div>
      </Content>
      <ProfileModal
        open={profileModalOpen}
        onClose={handleCloseProfileModal}
        profileData={profileData}
      />
    </Layout>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050913] flex items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
