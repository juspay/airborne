import Link from "next/link";

/**
 * The foot of a Control Center page: the way back to the older interface and, where a policy is not on yet, the one
 * place that offers to set it up. Both are fallbacks and openers, not part of the path a person takes through the page.
 */
export function ClassicLink({
  href,
  children,
  setUp,
}: {
  href: string;
  children: string;
  /** Offered only where approvals are known to be off. */
  setUp?: { href: string; label: string };
}) {
  return (
    <p className="space-x-3 border-t pt-3 text-xs text-muted-foreground">
      <span>
        Need the older interface?{" "}
        <Link href={href} className="underline hover:text-foreground">
          {children}
        </Link>
      </span>
      {setUp && (
        <span>
          Want a second person to approve releases?{" "}
          <Link href={setUp.href} className="underline hover:text-foreground">
            {setUp.label}
          </Link>
        </span>
      )}
    </p>
  );
}
