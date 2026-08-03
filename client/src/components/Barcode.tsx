import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// Real, scannable Code 128 barcode rendered as inline SVG so it stays crisp
// when printed. JsBarcode draws straight into the <svg> node.
export function Barcode({
  value,
  height = 44,
  barWidth = 1.6,
}: {
  value: string;
  height?: number;
  barWidth?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        width: barWidth,
        height,
        displayValue: false,
        margin: 0,
        background: "transparent",
        lineColor: "#000000",
      });
    } catch {
      // Unencodable value — leave the node empty rather than crashing the page.
    }
  }, [value, height, barWidth]);

  return <svg ref={ref} style={{ display: "block", width: "100%", height: `${height}px` }} />;
}

// QR generation is async, so cache by value: a sheet of 24 identical labels
// then renders instantly instead of firing 24 encode passes.
const qrCache = new Map<string, string>();

export function QrCode({ value, size = 104 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>(() => qrCache.get(value) ?? "");

  useEffect(() => {
    const cached = qrCache.get(value);
    if (cached) {
      setSvg(cached);
      return;
    }
    if (!value) {
      setSvg("");
      return;
    }
    let cancelled = false;
    QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M" })
      .then((s) => {
        qrCache.set(value, s);
        if (!cancelled) setSvg(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
