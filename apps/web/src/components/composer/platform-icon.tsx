import {
  AtSign,
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  PinIcon,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { SocialPlatform } from "@social-platform/shared";

// lucide has no TikTok/Threads glyph; Music2 and AtSign are the closest stand-ins and stay
// consistent with how each platform is labelled elsewhere.
const ICONS: Record<SocialPlatform, LucideIcon> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  TIKTOK: Music2,
  LINKEDIN: Linkedin,
  TWITTER: Twitter,
  THREADS: AtSign,
  PINTEREST: PinIcon,
  YOUTUBE: Youtube,
};

const LABELS: Record<SocialPlatform, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  TWITTER: "X",
  THREADS: "Threads",
  PINTEREST: "Pinterest",
  YOUTUBE: "YouTube",
};

export function platformLabel(platform: SocialPlatform): string {
  return LABELS[platform] ?? platform;
}

export function PlatformIcon({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  const Icon = ICONS[platform] ?? AtSign;
  return <Icon className={className} aria-hidden />;
}
