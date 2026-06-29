import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Privacy policy | LEO AI',
  description: 'How LEO AI processes personal data and user requests.',
};

export default function PrivacyPage() {
  return <LegalDocumentPage kind="privacy" />;
}
