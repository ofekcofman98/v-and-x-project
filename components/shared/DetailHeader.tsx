// // components/shared/DetailHeader.tsx
// 'use client';

// import Link from 'next/link';
// import { ArrowLeft } from 'lucide-react';
// import { Button } from '@/components/ui/button';

// interface DetailHeaderProps {
//   title: string;
//   description?: string | null;
//   backLink: string;
//   backLabel: string;
// }

// export function DetailHeader({ title, description, backLink, backLabel }: DetailHeaderProps) {
//   return (
//     <div className="flex items-center justify-between">
//       <div>
//         <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
//         {description && (
//           <p className="text-sm text-muted-foreground mt-2">{description}</p>
//         )}
//       </div>
      
//       <Button variant="outline" asChild>
//         <Link href={backLink} className="gap-2">
//           <ArrowLeft className="h-4 w-4" />
//           {backLabel}
//         </Link>
//       </Button>
//     </div>
//   );
// }