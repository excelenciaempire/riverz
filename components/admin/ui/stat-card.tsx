import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-brand-dark-secondary p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          
          {trend && (
            <p className={`mt-2 text-sm ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}% vs mes anterior
            </p>
          )}
        </div>
        
        <div className="rounded-full bg-brand-accent/20 p-3">
          <Icon className="h-6 w-6 text-brand-accent" />
        </div>
      </div>
    </div>
  );
}

