import React, { useState } from 'react';

export default function RecordArtwork({ trackId }) {
  const [swap, setSwap] = useState({ trackId, version: 0, animated: false });

  if (swap.trackId !== trackId) {
    setSwap({ trackId, version: swap.version + 1, animated: Boolean(swap.trackId && trackId) });
  }

  return (
    <div className="radio-record record-swap" aria-hidden="true">
      <div className="record-swap-frame" key={swap.version}>
        {swap.animated && <span className="radio-record-layer record-leaving"><span className="record-disc"><span /></span></span>}
        <span className={`radio-record-layer${swap.animated ? ' record-arriving' : ''}`}><span className="record-disc"><span /></span></span>
      </div>
    </div>
  );
}
