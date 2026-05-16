// components/shared/RelationCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface RelationCardProps {
    title: string;
    linkHref: string;
    linkLabel: string;
    description?: string | null;
  }

  export function RelationCard({ title, linkHref, linkLabel, description }: RelationCardProps) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href={linkHref} className="text-blue-600 hover:underline font-medium">
            {linkLabel}
          </Link>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </CardContent>
      </Card>
    );
  }