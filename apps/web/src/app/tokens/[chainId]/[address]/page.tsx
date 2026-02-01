// apps/web/src/app/tokens/[chainId]/[address]/page.tsx
import { Suspense } from 'react';
import { TokenAuditView } from '@/components/tokens/TokenAuditView';
import { Skeleton } from '@/components/ui/skeleton';

interface TokenPageProps {
  params: Promise<{
    chainId: string;
    address: string;
  }>;
}

export default async function TokenPage({ params }: TokenPageProps) {
  const { chainId, address } = await params;
  
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Suspense fallback={<TokenAuditSkeleton />}>
        <TokenAuditView chainId={chainId} address={address} />
      </Suspense>
    </div>
  );
}

function TokenAuditSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}