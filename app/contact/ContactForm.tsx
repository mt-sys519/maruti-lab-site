"use client";

import { useState } from "react";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xvkopnaa";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("sending");
    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      if (response.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <p className="contactSent" role="status">
        送信が完了しました。お問い合わせいただきありがとうございます。内容を確認のうえ、必要に応じてご連絡いたします。
      </p>
    );
  }

  return (
    <form className="contactForm" action={FORMSPREE_ENDPOINT} method="POST" onSubmit={handleSubmit}>
      <label>
        <span>お名前</span>
        <input type="text" name="name" autoComplete="name" required />
      </label>
      <label>
        <span>メールアドレス</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label>
        <span>お問い合わせ内容</span>
        <textarea name="message" rows={7} required />
      </label>
      {status === "error" && <p className="contactError" role="alert">送信に失敗しました。時間をおいて再度お試しください。</p>}
      <button type="submit" disabled={status === "sending"}>{status === "sending" ? "送信中…" : "送信する"}</button>
    </form>
  );
}
