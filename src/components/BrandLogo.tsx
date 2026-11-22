import { BRAND_NAME } from "@/lib/brand";

export function BrandLogo({ onNavy = false, className }: { onNavy?: boolean; className?: string }) {
  return (
    <img
      src={onNavy ? "/brand/neem-wordmark-on-navy.svg" : "/brand/neem-wordmark.svg"}
      alt={BRAND_NAME}
      width={126}
      height={30}
      className={className}
    />
  );
}
