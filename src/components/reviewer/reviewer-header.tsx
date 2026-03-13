"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const navLinks = [
  { href: "/reviewer/dashboard", label: "Dashboard" },
  { href: "/reviewer/submissions", label: "Submissions" },
  { href: "/reviewer/support", label: "Support" },
];

export function ReviewerHeader({ hasMultipleRoles = false }: { hasMultipleRoles?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-2 py-4">
        <Link href="/reviewer/dashboard">
          <Image
            src="/ccmi_logo.svg"
            alt="Commerce & Contract Management Institute"
            width={250}
            height={50}
            priority
          />
        </Link>

        <nav className="flex items-center gap-4">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              pathname.startsWith(link.href + "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#534F4F]/15 text-[#534F4F]"
                    : "text-[#004070] hover:text-[#00ABEB]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {hasMultipleRoles && (
            <Link
              href="/select-role"
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-[#004070] hover:border-[#00ABEB] hover:text-[#00ABEB]"
            >
              Switch Role
            </Link>
          )}
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
