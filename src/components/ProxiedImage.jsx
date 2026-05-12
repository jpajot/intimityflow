import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

const cache = new Map(); // module-level cache: url → dataUrl|null

export default function ProxiedImage({ src, alt, className, style }) {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    if (!src) return null;
    if (!src.includes("sharepoint.com")) return src;
    return cache.has(src) ? cache.get(src) : null;
  });
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!src) { setResolvedSrc(null); return; }
    if (!src.includes("sharepoint.com")) { setResolvedSrc(src); return; }
    if (cache.has(src)) { setResolvedSrc(cache.get(src)); return; }

    base44.functions.invoke("proxyImage", { url: src })
      .then((res) => {
        const dataUrl = res?.data?.dataUrl || null;
        cache.set(src, dataUrl);
        if (isMounted.current) setResolvedSrc(dataUrl);
      })
      .catch(() => {
        cache.set(src, null);
        if (isMounted.current) setResolvedSrc(null);
      });
  }, [src]);

  if (!resolvedSrc) return null;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      referrerPolicy="no-referrer"
    />
  );
}