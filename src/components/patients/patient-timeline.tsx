"use client";

import { UserPlus, Edit3, Calendar } from "lucide-react";
import type { Patient } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TimelineItemProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  date: string;
  isLast?: boolean;
}

function TimelineItem({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  date,
  isLast,
}: TimelineItemProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={14} className={iconColor} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-slate-100 mt-2" />}
      </div>
      <div className="pb-5 min-w-0">
        <p className="text-[13px] font-medium text-slate-800">{title}</p>
        <p className="text-[12px] text-slate-500 mt-0.5">{description}</p>
        <p className="text-[11px] text-slate-400 mt-1">{date}</p>
      </div>
    </div>
  );
}

interface PatientTimelineProps {
  patient: Patient;
}

export function PatientTimeline({ patient }: PatientTimelineProps) {
  const events: TimelineItemProps[] = [];

  events.push({
    icon: UserPlus,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
    title: "Patient registered",
    description: `${patient.first_name} ${patient.last_name} was added to the system${patient.patient_number ? ` as ${patient.patient_number}` : ""}.`,
    date: formatDate(patient.created_at),
  });

  const createdAt = new Date(patient.created_at).getTime();
  const updatedAt = new Date(patient.updated_at).getTime();

  if (updatedAt - createdAt > 5000) {
    events.push({
      icon: Edit3,
      iconColor: "text-violet-600",
      iconBg: "bg-violet-50",
      title: "Record updated",
      description: "Patient information was updated.",
      date: formatDate(patient.updated_at),
    });
  }

  const sorted = events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar size={20} className="text-slate-300 mx-auto mb-2" />
        <p className="text-[12px] text-slate-400">No timeline events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sorted.map((event, i) => (
        <TimelineItem key={i} {...event} isLast={i === sorted.length - 1} />
      ))}
    </div>
  );
}
