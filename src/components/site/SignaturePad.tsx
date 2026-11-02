"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PenLine, RotateCcw, ShieldCheck, Upload } from "lucide-react";
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
  existing: {
    url: string | null;
    createdAt: string;
    source: "drawn" | "uploaded";
  } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [redrawing, setRedrawing] = useState(!existing);
  const [source, setSource] = useState<"drawn" | "uploaded">("drawn");
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
    setSource("drawn");
  }

  /**
   * Use a picture of a signature instead of drawing one.
   *
   * Most people sign on paper far better than they sign with a mouse, and
   * refusing the photograph they already have is how you end up with a page
   * of illegible squiggles — or with nothing at all.
   *
   * The photograph is turned into ink on nothing rather than pasted in whole.
   * A phone picture of a signature is a grey-white rectangle, and dropped onto
   * a page as-is it reads as a sticker rather than a signature. So each pixel
   * is judged on how dark it is: white paper becomes transparent, the pen
   * stroke becomes the same ink colour as a drawn one, and the greys in
   * between keep the edges soft.
   */
  function loadFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fit inside the pad, keeping the shape, with a little room at the edges.
        const ratio = window.devicePixelRatio || 1;
        const boxW = canvas.width - 16 * ratio;
        const boxH = canvas.height - 16 * ratio;
        const k = Math.min(boxW / image.naturalWidth, boxH / image.naturalHeight);
        const w = image.naturalWidth * k;
        const h = image.naturalHeight * k;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);

        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = frame.data;

        for (let i = 0; i < px.length; i += 4) {
          const alpha = px[i + 3] / 255;
          if (alpha === 0) continue;

          // Perceived brightness: paper is bright, ink is not.
          const light =
            (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
          let ink = alpha * (1 - light);

          // Lift the paper off entirely and let the stroke reach full strength,
          // or a photograph leaves a grey haze across the whole pad.
          ink = (ink - 0.22) / (0.78 - 0.22);
          ink = ink < 0 ? 0 : ink > 1 ? 1 : ink;

          px[i] = 0x3a;
          px[i + 1] = 0x37;
          px[i + 2] = 0x2f;
          px[i + 3] = Math.round(ink * 255);
        }

        ctx.putImageData(frame, 0, 0);
        ctx.restore();

        setHasInk(true);
        setSource("uploaded");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
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
          Added {dateShort(existing.createdAt)}
          {existing.source === "uploaded" ? " from a picture you uploaded" : ""}.
          This is what appears when you sign something here.
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
        fd.set("source", source);
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
          Sign with your finger, or your mouse if you&rsquo;re on a computer —
          or use a photograph of your signature on paper.
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
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm text-bark underline underline-offset-2">
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Use a picture instead
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              e.target.value = "";
            }}
          />
        </label>
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
