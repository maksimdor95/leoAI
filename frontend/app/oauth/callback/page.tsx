import { OAuthCallbackClient } from '@/components/auth/OAuthCallbackClient';

type OAuthCallbackPageProps = {
  searchParams?: {
    success?: string;
    token?: string;
    error?: string;
  };
};

export default function OAuthCallbackPage({ searchParams }: OAuthCallbackPageProps) {
  return (
    <OAuthCallbackClient
      success={searchParams?.success}
      token={searchParams?.token}
      error={searchParams?.error}
    />
  );
}
