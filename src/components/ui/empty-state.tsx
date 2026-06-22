import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3.5">
        <Icon size={20} className="text-slate-400" />
      </div>
      <h3 className="text-[13px] font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
