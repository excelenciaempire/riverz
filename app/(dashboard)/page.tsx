import { redirect } from 'next/navigation';

export default function DashboardPage() {
  // Redirect to the crear page by default
  redirect('/crear');
}

