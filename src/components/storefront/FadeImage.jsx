import { useEffect, useRef, useState } from 'react';

// Design step 5: a picture that fades in softly when it has loaded (instead of popping in).
// A picture that is already loaded (cached) shows at once; a picture that fails shows its alt text.
// Reduced-motion phones get no fade (the global rule in index.css shortens every transition).
export default function FadeImage({ className = '', ...props }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ref.current?.complete) setReady(true);
  }, []);
  return (
    <img
      ref={ref}
      {...props}
      onLoad={(e) => {
        setReady(true);
        props.onLoad?.(e);
      }}
      onError={(e) => {
        setReady(true);
        props.onError?.(e);
      }}
      className={`${className} transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
    />
  );
}
