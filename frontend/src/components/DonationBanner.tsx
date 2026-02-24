"use client";

import React, { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Heart } from "lucide-react";

const KOFI_URL = "https://ko-fi.com/inksky";
const WALLET_ADDRESS = "8yQSRrGn9hSUG1n5vTidMWjVpGmBgEvrT8sWTA3WZqY";
const WALLET_SHORT = `${WALLET_ADDRESS.slice(0, 6)}...${WALLET_ADDRESS.slice(-6)}`;

export default function DonationBanner() {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showQR) return;
    const handler = (e: MouseEvent) => {
      if (qrRef.current && !qrRef.current.contains(e.target as Node)) {
        setShowQR(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showQR]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WALLET_ADDRESS);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = WALLET_ADDRESS;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative z-10 py-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* tag */}
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <Heart className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase">
            Support
          </span>
        </div>

        <h3 className="font-display text-xl sm:text-2xl font-semibold text-white mb-2">
          Help keep this tool{" "}
          <span className="text-yellow-400">free &amp; open</span>
        </h3>
        <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">
          No ads. No tracking. No paywalls on the free tier. If ToS Monitor helps you, consider keeping it running.
        </p>

        {/* buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Ko-fi */}
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF5E5B] hover:bg-[#ff4744] text-white text-sm font-medium transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682-.284-1.682-.284V7.18h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.065-2.059 2.119z" />
            </svg>
            Buy us a coffee
          </a>

          {/* USDC / Solana */}
          <div className="relative" ref={qrRef}>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
              {/* chain label */}
              <div className="flex items-center gap-1 px-3 py-2.5 border-r border-white/10">
                <span className="text-xs font-bold text-teal-400">USDC</span>
                <span className="text-[10px] text-zinc-500">Solana</span>
              </div>

              {/* address / copy */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-mono text-zinc-300 hover:text-white transition-colors"
                title="Copy wallet address"
              >
                {copied ? (
                  <span className="text-green-400 font-medium">COPIED ✓</span>
                ) : (
                  <>
                    {WALLET_SHORT}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </>
                )}
              </button>

              {/* QR toggle */}
              <button
                onClick={() => setShowQR((v) => !v)}
                className={`px-2.5 py-2.5 border-l border-white/10 transition-colors ${
                  showQR ? "text-yellow-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Show QR code"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3 3h7v7H3zm2 2v3h3V5zm8-2h7v7h-7zm2 2v3h3V5zM3 13h7v7H3zm2 2v3h3v-3zm9 0h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm4-4h2v2h-2zm0 4h2v2h-2z" />
                </svg>
              </button>
            </div>

            {/* QR popover */}
            {showQR && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 p-4 rounded-xl border border-white/10 bg-[#0c0c12] shadow-2xl text-center z-50">
                <p className="text-[10px] font-bold tracking-widest text-zinc-500 mb-2">
                  SCAN TO SEND USDC
                </p>
                <div className="p-2 rounded-lg bg-[#0c0c12] inline-block">
                  <QRCodeSVG
                    value={WALLET_ADDRESS}
                    size={140}
                    bgColor="#0c0c12"
                    fgColor="#D4FF00"
                    level="M"
                  />
                </div>
                <p className="mt-2 text-[10px] font-mono text-zinc-500">
                  {WALLET_SHORT}
                </p>
                <p className="text-[9px] text-zinc-600">Solana network</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
