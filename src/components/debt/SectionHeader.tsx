"use client";

export function SectionHeader({ title, color, children }: {
  title: string;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-6 rounded-full ${color}`} />
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
