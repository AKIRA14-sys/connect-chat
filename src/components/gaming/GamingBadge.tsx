import { cn } from "@/lib/utils";
import type { ShopGamingBadge } from "@/lib/shopGamingBadges";

interface GamingBadgeProps {
  badge: ShopGamingBadge;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GamingBadge({ badge, size = "md", className }: GamingBadgeProps) {
  const sizeMap = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  };

  const rarityStyles: Record<string, string> = {
    common: "bg-gray-600 border-gray-500",
    uncommon: "bg-green-700 border-green-500 shadow-sm",
    rare: "bg-gradient-to-br from-yellow-600 to-yellow-400 border-yellow-300 shadow-md",
    epic: "bg-gradient-to-br from-purple-700 to-purple-400 border-purple-300 shadow-lg animate-pulse",
    legendary: "bg-gradient-to-br from-orange-600 via-yellow-400 to-orange-600 border-yellow-200 shadow-xl animate-bounce-slow",
    mythic: "bg-gradient-to-tr from-cyan-500 via-purple-500 to-pink-500 border-white shadow-2xl animate-shimmer",
  };

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full border font-black transition-all duration-300",
        sizeMap[size],
        rarityStyles[badge.rarity] || rarityStyles.common,
        className
      )}
      style={{
        backgroundColor: badge.background.startsWith("linear-gradient") ? undefined : badge.background,
        color: badge.color,
        boxShadow: badge.boxShadow,
        borderWidth: badge.border ? undefined : "1px",
        borderColor: badge.border ? undefined : "currentColor",
      }}
    >
      <span className="z-10">{badge.icon}</span>
      {badge.rarity === "mythic" && (
        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
      )}
    </div>
  );
}
