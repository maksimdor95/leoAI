'use client';

import { Button } from 'antd';

type SocialAuthButtonProps = {
  text: string;
  onClick: () => void;
  hume?: boolean;
};

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

export function SocialAuthButton({ text, onClick, hume = false }: SocialAuthButtonProps) {
  return (
    <Button
      block
      onClick={onClick}
      icon={<YandexIcon />}
      className={`auth-social-btn ${
        hume
          ? 'auth-social-btn--hume'
          : 'auth-social-btn--leo'
      }`}
    >
      {text}
    </Button>
  );
}
