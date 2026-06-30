import type { Metadata } from 'next';
import { AppSettingsPage } from '@/components/settings/AppSettingsPage';

export const metadata: Metadata = {
  title: 'Settings | LEO AI',
  description: 'Language and appearance settings for LEO AI.',
};

export default function SettingsPage() {
  return <AppSettingsPage />;
}
