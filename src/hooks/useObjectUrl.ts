import { useEffect, useState } from 'react';

/** Object URL for binary image data, revoked automatically. */
export function useObjectUrl(data: ArrayBuffer | undefined, type = 'image/jpeg'): string | undefined {
  const [url, setUrl] = useState<string>();
  // Created inside the effect so StrictMode's mount → unmount → mount never leaves a revoked URL behind.
  useEffect(() => {
    if (!data) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(new Blob([data], { type }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data, type]);
  return url;
}
