"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PenLine, RotateCcw, ShieldCheck } from "lucide-react";
import { saveSignature } from "@/app/(site)/portal/signature-actions";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Form";
import { dateShort } from "@/lib/format";

/**
 * Draw a signature with a finger or a mouse.
 *
 * Pointer events rather than separate mouse and touch handlers, so a phone, a
 * trackpad and a stylus all behave the same. The canvas is sized to its own
 * displayed width times the device pixel ratio, or the line comes out blurry
 * on a phone and looks like a fax.
 */
export function SignaturePad({
  existing,
}: {
  existing: { url: string | null; createdAt: string } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [redrawing, setRedrawing] = useState(!existing);
  const [result, action] = useActionState(saveSignature, null);

  useEffect(() => {
    if (result?.ok) setRedrawing(false);
  }, [result]);

  useEffect(() => {
    if (!redrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#3a372f";
  }, [redrawing]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  if (!redrawing && existing) {
    return (
      <div className="space-y-4">
        {existing.url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={existing.url}
            alt="Your signature"
            className="h-20 rounded-[var(--radius-card)] border border-tan/30 bg-cream p-2"
          />
        )}
        <p className="text-xs text-ink-faint">
          Added {dateShort(existing.createdAt)}. This is what appears when you
          sign something here.
        </p>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          onClick={() => setRedrawing(true)}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Draw it again
        </Button>
        <Feedback result={result} />
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        const canvas = canvasRef.current;
        if (canvas) fd.set("image", canvas.toDataURL("image/png"));
        return action(fd);
      }}
      className="space-y-4"
    >
      <div>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-40 w-full touch-none rounded-[var(--radius-card)] border-2 border-dashed border-tan/50 bg-cream"
        />
        <p className="mt-2 text-xs text-ink-faint">
          Sign with your finger, or your mouse if you&rsquo;re on a computer.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" type="submit" disabled={!hasInk}>
          <PenLine className="h-3.5 w-3.5" aria-hidden />
          Save my signature
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={clear}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Start again
        </Button>
        {existing && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setRedrawing(false)}
          >
            Keep the old one
          </Button>
        )}
        <Feedback result={result} />
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" aria-hidden />
        Your signature is stored privately and only ever used when{" "}
        <strong>you</strong> sign something from your own account. Nobody else
        can sign in your name — not even Tausha. Every signing records the time
        and the device it came from.
      </p>
    </form>
  );
}
