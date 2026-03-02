"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ChevronDown } from "lucide-react";

const navLinks = [
  { href: "/corp-admin/dashboard", label: "Dashboard", dropdown: true },
  { href: "/corp-admin/manage-assessments", label: "Manage Assessments", dropdown: false },
  { href: null, label: "Results", dropdown: false },
  { href: null, label: "ROSTERS_DROPDOWN", dropdown: false },
  { href: null, label: "Support", dropdown: true },
  { href: null, label: "Account", dropdown: true },
];

const rostersDropdown = [
  { href: "/corp-admin/users", label: "Users" },
  { href: "/corp-admin/reviewers", label: "Reviewers" },
  { href: "/corp-admin/groups", label: "Groups" },
];

export function CorpAdminHeader() {
  const pathname = usePathname();

  const rostersActive = rostersDropdown.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const navItemClass = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-[#534F4F]/15 text-[#534F4F]" : "text-[#004070] hover:text-[#00ABEB]"
    }`;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-2 py-4">
        <Link href="/corp-admin/dashboard">
          <Image
            src="/ccmi_logo.svg"
            alt="Commerce & Contract Management Institute"
            width={250}
            height={50}
            priority
          />
        </Link>

        <nav className="flex items-center gap-2">
          {navLinks.map((link) => {
            if (link.label === "ROSTERS_DROPDOWN") {
              return (
                <div key="rosters" className="group relative">
                  <button className={navItemClass(rostersActive)}>
                    Rosters
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                  </button>
                  <div className="absolute left-0 top-full z-50 hidden min-w-[140px] overflow-hidden rounded-lg border bg-white shadow-md group-hover:block">
                    {rostersDropdown.map((item) => {
                      const isItemActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block px-4 py-2 text-sm font-medium transition-colors ${
                            isItemActive
                              ? "bg-[#534F4F]/10 text-[#534F4F]"
                              : "text-[#004070] hover:bg-gray-50 hover:text-[#00ABEB]"
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const isActive = link.href
              ? pathname === link.href || pathname.startsWith(link.href + "/")
              : false;

            if (!link.href) {
              return (
                <span key={link.label} className={navItemClass(isActive)}>
                  {link.label}
                  {link.dropdown ? <ChevronDown className="h-3.5 w-3.5" /> : null}
                </span>
              );
            }

            return (
              <Link key={link.href} href={link.href} className={navItemClass(isActive)}>
                {link.label}
                {link.dropdown ? <ChevronDown className="h-3.5 w-3.5" /> : null}
              </Link>
            );
          })}

          <UserButton />
        </nav>
      </div>
    </header>
  );
}
