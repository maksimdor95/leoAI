'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string[];
  skills: string[];
  experience_level: string | null;
  work_mode: string | null;
  source: string;
  source_url: string;
  description: string;
};

type CatalogResponse = {
  jobs: JobRow[];
  total: number;
  limit: number;
  offset: number;
  count: number;
};

function jobMatchingBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_JOB_MATCHING_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(':3001', ':3004') ||
    'http://127.0.0.1:3004'
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export default function JobsCatalogClient() {
  const searchParams = useSearchParams();
  const source = searchParams.get('source') || '';
  const limit = searchParams.get('limit') || '100';
  const offset = searchParams.get('offset') || '0';

  const [token, setToken] = useState('');
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const base = jobMatchingBaseUrl().replace(/\/$/, '');
    const params = new URLSearchParams();
    if (source.trim()) params.set('source', source.trim());
    params.set('limit', limit);
    params.set('offset', offset);

    const headers: Record<string, string> = {};
    if (token.trim()) {
      headers['X-Job-Catalog-Token'] = token.trim();
    }

    try {
      const res = await fetch(`${base}/api/jobs/catalog?${params}`, { headers });
      const text = await res.text();
      if (!res.ok) {
        setData(null);
        setError(`${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
        return;
      }
      setData(JSON.parse(text) as CatalogResponse);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [source, limit, offset, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px' }}>
          Каталог вакансий в БД
        </h1>
        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
          Запрос к job-matching <code>GET /api/jobs/catalog</code>. Фильтры:{' '}
          <code>?source=superjob.ru</code>, <code>limit</code>, <code>offset</code>.
        </p>
        <p style={{ margin: '12px 0 0', fontSize: 14 }}>
          <Link href="/">← На главную</Link>
        </p>
      </header>

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span>JOB_CATALOG_TOKEN (если задан на сервере)</span>
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="вставьте токен локально"
            style={{ padding: '8px 10px', minWidth: 240, borderRadius: 6, border: '1px solid #ccc' }}
          />
        </label>
        <button
          type="button"
          onClick={() => load()}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #1890ff',
            background: '#1890ff',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Обновить
        </button>
      </div>

      {loading ? <p style={{ color: '#666' }}>Загрузка…</p> : null}

      {error ? (
        <div
          style={{
            padding: 16,
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <strong>Ошибка.</strong> {error}
          <p style={{ margin: '12px 0 0', fontSize: 13 }}>
            Проверьте, что job-matching запущен ({jobMatchingBaseUrl()}), CORS разрешает этот origin, и
            для production передан токен.
          </p>
        </div>
      ) : null}

      {data ? (
        <>
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            Всего в БД (с учётом фильтра): <strong>{data.total}</strong>, показано:{' '}
            <strong>{data.count}</strong>
            {source ? (
              <>
                {' '}
                · источник: <code>{source}</code>
              </>
            ) : null}
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                background: '#fff',
                border: '1px solid #e8e8e8',
              }}
            >
              <thead>
                <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                  <th style={{ padding: 8, borderBottom: '1px solid #e8e8e8' }}>Источник</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e8e8e8' }}>Компания</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e8e8e8' }}>Вакансия</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e8e8e8' }}>Локация</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e8e8e8' }}>Уровень</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e8e8e8' }}>Навыки (в БД)</th>
                  <th style={{ padding: 8, borderBottom: '1px solid #e8e8e8' }}>Ссылка</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, color: '#666' }}>
                      Нет записей. Запустите скрейп или укажите{' '}
                      <Link href="?source=superjob.ru">?source=superjob.ru</Link>.
                    </td>
                  </tr>
                ) : (
                  data.jobs.map((job) => (
                    <tr key={job.id}>
                      <td
                        style={{ padding: 8, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}
                      >
                        {job.source}
                      </td>
                      <td
                        style={{ padding: 8, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}
                      >
                        {job.company}
                      </td>
                      <td
                        style={{ padding: 8, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}
                      >
                        <div>{job.title}</div>
                        <div style={{ color: '#888', marginTop: 4 }} title={job.description}>
                          {truncate(job.description || '', 120)}
                        </div>
                      </td>
                      <td
                        style={{ padding: 8, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}
                      >
                        {(job.location || []).join(', ') || '—'}
                      </td>
                      <td
                        style={{ padding: 8, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}
                      >
                        {job.experience_level ?? '—'}
                      </td>
                      <td
                        style={{ padding: 8, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}
                      >
                        {(job.skills || []).join(', ') || '—'}
                      </td>
                      <td
                        style={{ padding: 8, borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' }}
                      >
                        <a href={job.source_url} target="_blank" rel="noopener noreferrer">
                          Открыть
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <section style={{ marginTop: 32, fontSize: 13, color: '#555' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>CLI (curl)</h2>
        <pre
          style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12,
          }}
        >
          {`curl -sS "${jobMatchingBaseUrl()}/api/jobs/catalog?source=superjob.ru&limit=20" \\
  -H "X-Job-Catalog-Token: YOUR_TOKEN"   # если задан JOB_CATALOG_TOKEN`}
        </pre>
      </section>
    </div>
  );
}
