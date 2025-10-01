import { ReactNode } from "react";
export default function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      {action}
    </div>
  );
}
