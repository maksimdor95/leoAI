import type { Metadata } from 'next';
import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';

export const metadata: Metadata = {
  title: 'Terms of use | LEO AI',
  description: 'Rules for using the LEO AI website, product, and support.',
};

export default function TermsPage() {
  return <LegalDocumentPage kind="terms" />;
}
