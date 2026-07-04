import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface StatCardProps {
    title: string;
    value: string | number;
  }

export const StatCard = React.memo(({ title, value }: StatCardProps) => {
    return (
        <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
            </CardHeader>
        
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
});