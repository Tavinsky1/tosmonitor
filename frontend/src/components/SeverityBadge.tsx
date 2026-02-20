interface SeverityBadgeProps {
  severity: "critical" | "major" | "minor" | "patch" | string;
  size?: "sm" | "md" | "lg";
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const styles = {
    critical: "severity-critical",
    major: "severity-major",
    minor: "severity-minor",
    patch: "severity-patch",
  };

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
    lg: "text-sm px-3 py-1",
  };

  return (
    <span className={`severity-badge ${styles[severity as keyof typeof styles] || styles.patch} ${sizeStyles[size]}`}>
      {severity}
    </span>
  );
}
