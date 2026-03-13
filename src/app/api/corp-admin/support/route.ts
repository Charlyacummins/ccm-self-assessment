import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };

  const { name, email, subject, message } = body;

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const supportEmail = process.env.SUPPORT_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;

  if (supportEmail && resendKey) {
    const html = `
      <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr />
      <p>${message.replace(/\n/g, "<br />")}</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: supportEmail,
        reply_to: email,
        subject: `[Support] ${subject}`,
        html,
      }),
    });

    if (!res.ok) {
      console.error("[corp-admin/support] Resend error", await res.text());
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }
  } else {
    // Email not yet configured — log for visibility
    console.log("[corp-admin/support] Support request (email not configured)", {
      name,
      email,
      subject,
      message: message.slice(0, 200),
    });
  }

  return NextResponse.json({ ok: true });
}
