import type { Metadata } from 'next';
import { AccountPage } from '@/components/account/AccountPage';

export const metadata: Metadata = {
  title: 'Account | LEO AI',
  description: 'Your LEO AI account — email and saved chats.',
};

export default function AccountRoutePage() {
  return <AccountPage />;
}
