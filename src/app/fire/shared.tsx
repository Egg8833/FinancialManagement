export function SliderInput({ label, value, onChange, min, max, step, format }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-bold text-gray-900">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

export function NumberInput({ label, value, onChange, prefix }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">{label}</label>
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-indigo-400">
        {prefix && (
          <span className="px-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 h-10 flex items-center">
            {prefix}
          </span>
        )}
        <input
          type="number" value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white"
        />
      </div>
    </div>
  );
}

export function formatTWD(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)} 億`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)} 萬`;
  return v.toLocaleString('en-US');
}
