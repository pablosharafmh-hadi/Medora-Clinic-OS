import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, action, className }: Props) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
