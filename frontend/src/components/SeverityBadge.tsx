interface SeverityBadgeProps {
  severity: "critical" | "major" | "minor" | "patch" | string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const styles = {
    critical: "severity-critical",
    major: "severity-major",
    minor: "severity-minor",
    patch: "severity-patch",
  };

  return (
    <span className={`severity-badge ${styles[severity as keyof typeof styles] || styles.patch}`}>
      {severity}
    </span>
  );
}
