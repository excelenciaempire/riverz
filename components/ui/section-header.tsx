import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Editorial section header. Used across the app — title falls back to
 * the editorial display sizing automatically when the parent has the
 * `app-v2` class on it (i.e. anywhere inside the dashboard layout).
 */
export function SectionHeader({
  title,
  description,
  icon,
  action,
  className,
  size = 'md',
}: SectionHeaderProps) {
  const sizes = {
    sm: { title: 'text-[20px]', description: 'text-[12px]', spacing: 'mb-4' },
    md: { title: 'text-[26px] md:text-[30px]', description: 'text-[13px]', spacing: 'mb-5' },
    lg: { title: 'text-[34px] md:text-[42px]', description: 'text-[14px]', spacing: 'mb-7' },
  };

  return (
    <div className={cn('app-v2-section-head', sizes[size].spacing, className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#0a0a0a] text-[#f7ff9e]">
            {icon}
          </div>
        )}
        <div>
          <h2
            className={cn(
              'font-medium tracking-tight text-black leading-[1.1]',
              sizes[size].title,
            )}
            style={{ letterSpacing: '-0.025em' }}
          >
            {title}
          </h2>
          {description && (
            <p className={cn('text-black/55 mt-1', sizes[size].description)}>{description}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
