"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, Trash2, ZoomIn } from "lucide-react";
import { clearAvatar, saveAvatar } from "@/app/(site)/portal/avatar-actions";
import { Button } from "@/components/ui/Button";
import { Feedback } from "@/components/ui/Form";

/** The side of the picture that gets stored, in real pixels. */
const OUTPUT = 512;
/** The side of the frame on screen. */
const FRAME = 260;

type View = { scale: number; x: number; y: number };

/**
 * Pick a picture, then move and zoom it until the right bit is in the circle.
 *
 * All of the work happens here rather than on the server: a photograph off a
 * phone is several megabytes and mostly sky, and sending that up so a server
 * can throw 95% of it away is slow on the kind of connection this building
 * actually has. What leaves the browser is the finished 512-pixel square.
 *
 * The frame is shown as a circle because that is how it will appear beside a
 * message, and a square preview that turns out circular later is how people
 * end up with their own chin cut off.
 */
export function AvatarPicker({ existing }: { existing: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const [chosen, setChosen] = useState(false);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [minScale, setMinScale] = useState(1);
  const [result, action] = useActionState(saveAvatar, null);
  const [removing, setRemoving] = useState(false);
  const [removeResult, setRemoveResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (result?.ok) setChosen(false);
  }, [result]);

  /** Repaint the frame from the current image and view. */
  function draw() {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    if (canvas.width !== FRAME * ratio) {
      canvas.width = FRAME * ratio;
      canvas.height = FRAME * ratio;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, FRAME, FRAME);

    const w = image.naturalWidth * view.scale;
    const h = image.naturalHeight * view.scale;
    ctx.drawImage(image, view.x, view.y, w, h);
  }

  useEffect(draw);

  function load(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        imageRef.current = image;
        // Start at the smallest zoom that still fills the frame, centred —
        // the view almost everyone wants, so most people never touch the
        // slider at all.
        const fit = Math.max(
          FRAME / image.naturalWidth,
          FRAME / image.naturalHeight,
        );
        setMinScale(fit);
        setView({
          scale: fit,
          x: (FRAME - image.naturalWidth * fit) / 2,
          y: (FRAME - image.naturalHeight * fit) / 2,
        });
        setChosen(true);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /** Keep the picture covering the frame, however it is dragged or zoomed. */
  function clamp(next: View): View {
    const image = imageRef.current;
    if (!image) return next;
    const w = image.naturalWidth * next.scale;
    const h = image.naturalHeight * next.scale;
    return {
      scale: next.scale,
      x: Math.min(0, Math.max(FRAME - w, next.x)),
      y: Math.min(0, Math.max(FRAME - h, next.y)),
    };
  }

  function zoomTo(scale: number) {
    setView((v) => {
      // Zoom about the middle of the frame, so the face stays where it was
      // rather than sliding off towards a corner.
      const factor = scale / v.scale;
      return clamp({
        scale,
        x: FRAME / 2 - (FRAME / 2 - v.x) * factor,
        y: FRAME / 2 - (FRAME / 2 - v.y) * factor,
      });
    });
  }

  /** The finished square, at full output size rather than screen size. */
  function toDataUrl(): string {
    const image = imageRef.current;
    if (!image) return "";

    const out = document.createElement("canvas");
    out.width = OUTPUT;
    out.height = OUTPUT;
    const ctx = out.getContext("2d");
    if (!ctx) return "";

    // White underneath, because JPEG has no transparency and a PNG with a
    // see-through corner would show as black in most places it gets used.
    ctx.fillStyle = "#faf6ee";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);

    const k = OUTPUT / FRAME;
    ctx.drawImage(
      image,
      view.x * k,
      view.y * k,
      image.naturalWidth * view.scale * k,
      image.naturalHeight * view.scale * k,
    );

    return out.toDataURL("image/jpeg", 0.9);
  }

  if (!chosen) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-5">
          {existing ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={existing}
              alt="Your profile picture"
              className="h-24 w-24 rounded-full border border-tan/30 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-tan/50 bg-cream">
              <Camera className="h-7 w-7 text-tan" aria-hidden />
            </div>
          )}

          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-olive px-4 py-2 text-sm font-medium text-cream">
              <Camera className="h-4 w-4" aria-hidden />
              {existing ? "Choose a different one" : "Choose a picture"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) load(file);
                  e.target.value = "";
                }}
              />
            </label>

            {existing && (
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  disabled={removing}
                  onClick={async () => {
                    setRemoving(true);
                    setRemoveResult(await clearAvatar());
                    setRemoving(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Take it down
                </Button>
              </div>
            )}
          </div>
        </div>

        <Feedback result={result} />
        <Feedback result={removeResult} />

        <p className="text-xs leading-relaxed text-ink-faint">
          This will appear next to your name in messages. Only people here see
          it — it is never public, and never shared anywhere else.
        </p>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("image", toDataUrl());
        return action(fd);
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-start gap-6">
        <div
          className="relative shrink-0 touch-none overflow-hidden rounded-full border border-tan/30 bg-cream"
          style={{ width: FRAME, height: FRAME }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: FRAME, height: FRAME }}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragging.current = { x: e.clientX - view.x, y: e.clientY - view.y };
            }}
            onPointerMove={(e) => {
              const origin = dragging.current;
              if (!origin) return;
              // Worked out here rather than inside the updater: React may run
              // that later, by which time the pointer can already have been
              // released and the origin cleared.
              const x = e.clientX - origin.x;
              const y = e.clientY - origin.y;
              setView((v) => clamp({ scale: v.scale, x, y }));
            }}
            onPointerUp={() => {
              dragging.current = null;
            }}
            onPointerLeave={() => {
              dragging.current = null;
            }}
            onWheel={(e) => {
              zoomTo(
                Math.min(
                  minScale * 6,
                  Math.max(minScale, view.scale * (e.deltaY < 0 ? 1.1 : 0.9)),
                ),
              );
            }}
          />
        </div>

        <div className="min-w-[220px] flex-1 space-y-4">
          <label className="block">
            <span className="eyebrow !text-[0.6rem] flex items-center gap-1.5 text-bark">
              <ZoomIn className="h-3.5 w-3.5" aria-hidden />
              Zoom
            </span>
            <input
              type="range"
              min={minScale}
              max={minScale * 6}
              step={minScale / 100}
              value={view.scale}
              onChange={(e) => zoomTo(Number(e.target.value))}
              className="mt-2 w-full accent-olive"
            />
          </label>

          <p className="text-sm leading-relaxed text-ink-soft">
            Drag the picture to move it, and use the slider to zoom. What you
            can see in the circle is what everyone else will see.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">
              <Check className="h-4 w-4" aria-hidden />
              Use this
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setChosen(false)}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Start again
            </Button>
          </div>

          <Feedback result={result} />
        </div>
      </div>
    </form>
  );
}
