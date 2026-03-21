"use client";

import { useRef, useState } from "react";

export default function SignaturePad({
  onSave,
}: {
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  const start = (e: any) => {
    setDrawing(true);
    draw(e);
  };

  const end = () => {
    setDrawing(false);
  };

  const draw = (e: any) => {
    if (!drawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    const x = (e.touches?.[0]?.clientX || e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY || e.clientY) - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="space-y-2">

      <canvas
        ref={canvasRef}
        width={300}
        height={120}
        className="border rounded-xl w-full bg-white"
        onMouseDown={start}
        onMouseUp={end}
        onMouseMove={draw}
        onTouchStart={start}
        onTouchEnd={end}
        onTouchMove={draw}
      />

      <div className="flex gap-2">
        <button
          onClick={clear}
          className="flex-1 bg-gray-200 py-2 rounded-lg text-sm"
        >
          Limpar
        </button>

        <button
          onClick={save}
          className="flex-1 bg-[#80b02d] text-white py-2 rounded-lg text-sm"
        >
          Salvar assinatura
        </button>
      </div>

    </div>
  );
}