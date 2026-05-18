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
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'conic-gradient(from 45deg, #4285F4 0deg 90deg, #34A853 90deg 180deg, #FBBC05 180deg 270deg, #EA4335 270deg 360deg)',
        color: 'white',
        fontWeight: 700,
        fontSize: 12,
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
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ff0000',
        color: 'white',
        fontWeight: 700,
        fontSize: 12,
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
      className="!h-12 !rounded-xl !border !border-white/10 !bg-black/30 !text-white/90 !font-medium !text-base shadow-none hover:!bg-white/[0.06] hover:!border-white/20 hover:!text-white [&_.ant-btn-icon]:!flex [&_.ant-btn-icon]:!items-center"
    >
      {text}
    </Button>
  );
}
