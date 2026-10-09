import styles from "./logo.module.css";

// Same component as NoorAI Lab Studio (apps/web/src/components/Logo.tsx), so the two products match.
export interface LogoProps {
  /** Mark height in px (default 32). Below 24px use the small mark file instead. */
  size?: number;
  /** On forest green or dark photos. */
  reverse?: boolean;
  /** false shows the mark alone. */
  showName?: boolean;
  /** Shown after a divider, e.g. "Tracks". */
  product?: string;
}

const RAYS = ["M50 22V12", "M34 29L28 21", "M66 29L72 21", "M24 42L15 38", "M76 42L85 38"];

/** The Book of dawn mark with the NoorAI wordmark. Colours come from the logo-* tokens. */
export function Logo({ size = 32, reverse = false, showName = true, product }: LogoProps) {
  const markOnly = !showName;
  const mark = (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`${styles.mark} ${reverse ? styles.reverse : ""}`}
      role={markOnly ? "img" : undefined}
      aria-label={markOnly ? "NoorAI" : undefined}
      aria-hidden={markOnly ? undefined : true}
    >
      <g className={styles.rays} fill="none" strokeWidth={5} strokeLinecap="round">
        {RAYS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle className={styles.sun} cx={50} cy={52} r={16} />
      <path className={styles.pageLeft} d="M50 84C40 77 26 76 12 80V54C26 50 40 52 50 60Z" />
      <path className={styles.pageRight} d="M50 84C60 77 74 76 88 80V54C74 50 60 52 50 60Z" />
    </svg>
  );

  if (markOnly) return mark;

  return (
    <span
      className={`${styles.logo} ${reverse ? styles.reverse : ""}`}
      style={{ fontSize: `${Math.round(size * 0.56)}px` }}
      dir="ltr"
    >
      {mark}
      <span className={styles.name}>
        Noor<span className={styles.ai}>AI</span>
      </span>
      {product ? <span className={styles.product}>{product}</span> : null}
    </span>
  );
}
