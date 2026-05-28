"use client";

export function XmlDownload({
  label,
  base64,
  filename,
}: {
  label: string;
  base64: string | null | undefined;
  filename: string;
}) {
  if (!base64) return null;

  function download() {
    if (!base64) return;
    try {
      const xml = atob(base64.replace(/\s/g, ""));
      const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("No se pudo decodificar el XML");
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
    >
      Descargar {label}
    </button>
  );
}
