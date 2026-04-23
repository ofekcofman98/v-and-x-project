'use client';

/**
 * Dashboard Overview - Main dashboard page
 * Links to Base Lists and Tables sections
 */

import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { List, Table } from 'lucide-react';

export default function DashboardPage() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col">
        <section className="container py-8 md:py-12">
          <div className="flex flex-col gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Manage your base lists and tables
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/dashboard/base-lists" className="group">
              <Card className="h-full transition-colors hover:border-primary cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <List className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle>Base Lists</CardTitle>
                  </div>
                  <CardDescription>
                    Manage your entity lists and define the core data that will be used across multiple tables.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Create and manage lists of entities like students, products, or any other items you want to track.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/tables" className="group">
              <Card className="h-full transition-colors hover:border-primary cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Table className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle>Tables</CardTitle>
                  </div>
                  <CardDescription>
                    View and manage all your data tables in one place.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Access all tables, view data, and manage table-specific information.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
