import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const avatarVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full bg-action-primary font-semibold text-ink-on-primary overflow-hidden',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-14 w-14 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

const avatarSizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' } as const;

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string | null;
  /** Mascot character id (e.g. "fox"). When set it replaces the photo and the initials: every person is shown the same way everywhere. */
  character?: string | null;
  className?: string;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, character, size, className }: AvatarProps) {
  if (character) {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          'inline-flex shrink-0 overflow-hidden rounded-full bg-surface-subtle',
          avatarSizes[size ?? 'md'],
          className,
        )}
        style={{
          backgroundImage: `url(/mascots/${character}-directions.webp)`,
          // 300% makes each cell of the 3x3 direction sheet a clean 0/50/100% step; 50% 50% is the centre cell, looking straight ahead.
          backgroundSize: '300% 300%',
          backgroundPosition: '50% 50%',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }
  return (
    <span className={cn(avatarVariants({ size }), className)}>
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <>
          <span aria-hidden="true">{initialsFrom(name)}</span>
          <span className="sr-only">{name}</span>
        </>
      )}
    </span>
  );
}
