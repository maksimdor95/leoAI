import type { Metadata } from 'next';
import { AppSettingsPage } from '@/components/settings/AppSettingsPage';

export const metadata: Metadata = {
  title: 'Settings | LEO AI',
  description: 'Language, theme, voice replies, and text-only mode for LEO AI.',
};

export default function SettingsPage() {
  return <AppSettingsPage />;
}
