import { CheckCircle2, TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, ShieldX, Clock } from "lucide-react";

const MAP = {
  fair: { icon: CheckCircle2, cls: "badge-fair" },
  high: { icon: TrendingUp, cls: "badge-high" },
  low: { icon: TrendingDown, cls: "badge-low" },
  insufficient: { icon: AlertTriangle, cls: "badge-insufficient" },
};

function Pill({ icon: Icon, cls, label }) {
  return (
    <div className={`badge ${cls}`}>
      <Icon size={14} />
      <span>{label}</span>
    </div>
  );
}

export default function Badge({ status, label }) {
  return <Pill {...(MAP[status] || MAP.insufficient)} label={label} />;
}

const VERIFICATION = {
  verified: { icon: ShieldCheck, cls: "badge-fair", label: "Owner verified" },
  pending: { icon: Clock, cls: "badge-insufficient", label: "Verification pending" },
  rejected: { icon: ShieldX, cls: "badge-high", label: "Verification failed" },
};

export function VerificationBadge({ status }) {
  return <Pill {...(VERIFICATION[status] || VERIFICATION.pending)} />;
}
