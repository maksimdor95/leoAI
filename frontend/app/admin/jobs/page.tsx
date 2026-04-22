import type { Metadata } from 'next';
import { Suspense } from 'react';
import JobsCatalogClient from './JobsCatalogClient';

export const metadata: Metadata = {
  title: 'Каталог вакансий (БД)',
};

export default function AdminJobsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Загрузка…</div>}>
      <JobsCatalogClient />
    </Suspense>
  );
}
