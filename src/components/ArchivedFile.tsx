import React, { useEffect, useState } from "react";
import { apiFetch } from "../services/supabase";

function driveId(source?: string) {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.hostname !== "drive.google.com") return null;
    const id =
      url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ||
      url.searchParams.get("id");
    return id && /^[\w-]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
async function archivedBlob(id: string, signal?: AbortSignal) {
  const response = await apiFetch(
    "/api/files/" + encodeURIComponent(id) + "/content",
    { signal },
  );
  if (!response.ok)
    throw new Error("Không thể tải tệp hoặc bạn không có quyền truy cập.");
  return response.blob();
}

export function ArchivedImage({
  src,
  alt,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const id = driveId(src);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setUrl("");
    setError("");
    if (!id) return;
    const controller = new AbortController();
    let objectUrl = "";
    void archivedBlob(id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  if (id && !url)
    return (
      <span
        role={error ? "alert" : "status"}
        className="text-xs text-slate-500 p-2"
      >
        {error || "Đang tải ảnh…"}
      </span>
    );
  return <img {...props} alt={alt || "Ảnh đính kèm"} src={id ? url : src} />;
}

export function ArchivedFileLink({ src, name }: { src: string; name: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = driveId(src);
  return (
    <span className="min-w-0">
      <a
        href={src}
        download={name}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 underline break-all"
        onClick={async (e) => {
          if (!id) return;
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const url = URL.createObjectURL(await archivedBlob(id));
            const link = document.createElement("a");
            link.href = url;
            link.download = name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Đang tải…" : "Tải về / Xem " + name}
      </a>
      {error && (
        <span role="alert" className="block text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
