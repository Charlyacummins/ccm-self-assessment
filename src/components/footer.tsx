import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-auto bg-[#004070]">
      {/* Top border line */}
      <div className="h-px bg-[#00ABEB]" />

      <div className="mx-auto max-w-screen-2xl px-6 py-8">
        <Image
          src="/ccmi_footer.svg"
          alt="Commerce & Contract Management Institute"
          width={200}
          height={37}
        />

        {/* Divider */}
        <div className="mt-4 mb-2 h-px bg-white/20" />

        <Image
          src="/footer_logo_group.svg"
          alt="The Institute was co-founded by NCMA & WorldCommerce & Contracting"
          width={383}
          height={48}
        />

        {/* Bottom divider */}
        <div className="mt-2 h-px bg-white/20" />
      </div>

      
    </footer>
  );
}
