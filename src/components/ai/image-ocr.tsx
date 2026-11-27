"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ImageOcrProps {
  text: string;
  maxLength: number;
  onTextExtracted: (text: string) => void;
}

export function ImageOcr({ text, onTextExtracted, maxLength }: ImageOcrProps) {
  const [image, setImage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resizeImage(file: File, maxWidth: number): Promise<string> {
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Cannot get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Cannot load image"));
    };
    img.src = objectUrl;
    return promise;
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh.");
      return;
    }

    setError("");
    setPending(true);
    setProgress(0);
    onTextExtracted("");

    try {
      const resized = await resizeImage(file, 1200);
      setImage(resized);

      // Lazy-load Tesseract.js so the OCR worker is only fetched when the user picks an image.
      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(resized, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      onTextExtracted(result.data.text);
      if (!result.data.text.trim()) setError("Không tìm thấy chữ trong ảnh. Bạn có thể nhập văn bản bên dưới.");
    } catch (err) {
      setError("Không nhận dạng được văn bản từ ảnh. Hãy thử ảnh khác.");
      console.error(err);
    } finally {
      setPending(false);
      setProgress(0);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border-2 bg-card p-5">
      <div>
        <h3 className="mb-2 text-lg font-extrabold">Nhận dạng văn bản từ ảnh</h3>
        <p className="text-muted-foreground text-sm">
          Chọn ảnh có chữ tiếng Anh. Ảnh xử lý trên trình duyệt, không gửi lên server.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Chọn ảnh để nhận dạng văn bản"
      />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
        >
          {pending ? `Đang nhận dạng... ${progress}%` : "Chọn ảnh"}
        </Button>
        {image && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setImage(null);
              setError("");
              onTextExtracted("");
            }}
          >
            Xóa ảnh
          </Button>
        )}
      </div>

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Ảnh dùng để nhận dạng" className="max-h-64 rounded-2xl border-2" />
      )}
      <div>
        <label htmlFor="ocr-text" className="mb-1 block font-bold">Văn bản trích xuất</label>
        <textarea
          id="ocr-text"
          value={text}
          onChange={(event) => onTextExtracted(event.target.value)}
          disabled={pending}
          rows={6}
          maxLength={maxLength}
          className="w-full rounded-2xl border-2 bg-background p-3 text-sm"
          placeholder="Kiểm tra và sửa nội dung trước khi tạo thẻ."
        />
      </div>
    </div>
  );
}
