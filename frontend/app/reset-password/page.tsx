import { Suspense } from 'react';
import { Spin } from 'antd';
import { ResetPasswordClient } from './ResetPasswordClient';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050913]">
          <Spin size="large" />
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
