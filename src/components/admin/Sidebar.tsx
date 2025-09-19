import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/management/test-takers", label: "Test Takers" },
  { href: "/management/questions", label: "Questions" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar() {
  return (
    <nav className="space-y-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={`/admin${link.href}`}
          className="block px-2 py-1 rounded hover:bg-gray-200"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
