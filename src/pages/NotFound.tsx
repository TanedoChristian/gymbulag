import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui';

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <EmptyState icon={<Compass />} title="This page doesn't exist">
        <Link to="/" className="font-semibold text-indigo-600 dark:text-indigo-400">
          Go to calendar
        </Link>
      </EmptyState>
    </>
  );
}
