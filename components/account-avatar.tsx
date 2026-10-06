import Image from "next/image";

export function AccountAvatar({ name, image, size = "small" }: { name: string; image?: string | null; size?: "small" | "large" }) {
  const safeImage = image?.startsWith("https://") || image?.startsWith("/assets/avatars/") ? image : null;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "QG";
  return <span className={`account-avatar account-avatar--${size}`} aria-hidden="true">
    {safeImage ? <Image src={safeImage} alt="" width={58} height={58} unoptimized referrerPolicy="no-referrer"/> : <span>{initials}</span>}
  </span>;
}
