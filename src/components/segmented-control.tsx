import { cn } from '@helpers/tailwind';

export type SegmentedControlOption<TValue extends string | number> = {
  label: string;
  value: TValue;
};

export const SegmentedControl = <TValue extends string | number>({
  ariaLabel,
  onChange,
  options,
  value
}: {
  ariaLabel: string;
  onChange: (value: TValue) => void;
  options: Array<SegmentedControlOption<TValue>>;
  value: TValue;
}) => (
  <div
    aria-label={ariaLabel}
    className="inline-grid w-full overflow-hidden rounded-md border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-950"
    role="group"
    style={{
      gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`
    }}
  >
    {options.map(option => {
      const isSelected = option.value === value;
      return (
        <button
          aria-pressed={isSelected}
          className={cn(
            'inline-flex min-h-9 items-center justify-center rounded-sm px-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-none',
            isSelected
              ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
          )}
          key={option.value}
          onClick={() => {
            onChange(option.value);
          }}
          type="button"
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
