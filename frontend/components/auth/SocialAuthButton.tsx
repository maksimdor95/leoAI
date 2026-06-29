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
      className={
        hume
          ? '!h-12 !rounded-xl !border !border-[rgba(34,34,34,0.12)] !bg-[var(--color-paper)] !text-[var(--color-ink)] !font-medium !text-base shadow-none hover:!bg-[var(--color-bone)] [&_.ant-btn-icon]:!flex [&_.ant-btn-icon]:!items-center'
          : '!h-12 !rounded-xl !border !border-white/10 !bg-black/30 !text-white/90 !font-medium !text-base shadow-none hover:!bg-white/[0.06] hover:!border-white/20 hover:!text-white [&_.ant-btn-icon]:!flex [&_.ant-btn-icon]:!items-center'
      }
    >
      {text}
    </Button>
  );
}
