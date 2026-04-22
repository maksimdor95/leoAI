import { redirect } from 'next/navigation';

/** /admin → /admin/jobs */
export default function AdminIndexPage() {
  redirect('/admin/jobs');
}
