export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <main className="bg-[rgb(var(--institute-blue))] min-h-screen">{children}</main>;
}
