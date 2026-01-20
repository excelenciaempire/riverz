import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SectionHeader({
  title,
  description,
  icon,
  action,
  className,
  size = 'md',
}: SectionHeaderProps) {
  const sizes = {
    sm: {
      title: 'text-lg',
      description: 'text-xs',
      spacing: 'mb-4',
    },
    md: {
      title: 'text-2xl',
      description: 'text-sm',
      spacing: 'mb-6',
    },
    lg: {
      title: 'text-3xl',
      description: 'text-base',
      spacing: 'mb-8',
    },
  };

  return (
    <div className={cn('flex items-center justify-between', sizes[size].spacing, className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent">
            {icon}
          </div>
        )}
        <div>
          <h2 className={cn('font-semibold text-white', sizes[size].title)}>
            {title}
          </h2>
          {description && (
            <p className={cn('text-gray-400 mt-0.5', sizes[size].description)}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
