'use client';

import { Button } from 'antd';

type SocialProvider = 'google' | 'yandex';

type SocialAuthButtonProps = {
  provider: SocialProvider;
  text: string;
  onClick: () => void;
};

function GoogleIcon() {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'conic-gradient(from 45deg, #4285F4 0deg 90deg, #34A853 90deg 180deg, #FBBC05 180deg 270deg, #EA4335 270deg 360deg)',
        color: 'white',
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      G
    </span>
  );
}

function YandexIcon() {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ff0000',
        color: 'white',
        fontWeight: 700,
        fontSize: 14,
      }}
    >
      Я
    </span>
  );
}

export function SocialAuthButton({ provider, text, onClick }: SocialAuthButtonProps) {
  const icon = provider === 'google' ? <GoogleIcon /> : <YandexIcon />;

  return (
    <Button
      block
      onClick={onClick}
      icon={icon}
      style={{
        height: 52,
        borderRadius: 10,
        border: '1px solid #cfd3e2',
        background: '#f5f6fb',
        color: '#545a78',
        fontSize: 16,
        fontWeight: 500,
      }}
    >
      {text}
    </Button>
  );
}
