import React, { useMemo } from 'react';
import { encodeCode128B, generateBarcodeRectangles } from '../utils/barcode';

interface BarcodeRendererProps {
  value: string;
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
  className?: string;
  lightBackground?: boolean;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  height = 56,
  moduleWidth = 2,
  showText = true,
  className = '',
  lightBackground = true,
}) => {
  const barcodeData = useMemo(() => {
    try {
      const modules = encodeCode128B(value);
      return generateBarcodeRectangles(modules, moduleWidth, height);
    } catch {
      return null;
    }
  }, [value, moduleWidth, height]);

  if (!barcodeData) {
    return (
      <div className="text-xs text-rose-500 font-mono">
        Invalid barcode sequence: {value}
      </div>
    );
  }

  const { rects, totalWidth } = barcodeData;
  const paddingX = 12;
  const svgWidth = totalWidth + paddingX * 2;
  const svgHeight = height + (showText ? 24 : 8);

  return (
    <div
      className={`inline-flex flex-col items-center select-none ${
        lightBackground ? 'bg-white p-3 rounded border border-slate-200 shadow-sm' : ''
      } ${className}`}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto max-w-full"
        style={{ minWidth: '160px', shapeRendering: 'crispEdges' }}
      >
        <g transform={`translate(${paddingX}, 4)`}>
          {rects.map((r, i) => (
            <rect
              key={i}
              x={r.x}
              y={0}
              width={r.width}
              height={r.height}
              fill="#0F172A"
            />
          ))}
        </g>
        {showText && (
          <text
            x={svgWidth / 2}
            y={svgHeight - 4}
            textAnchor="middle"
            fill="#334155"
            fontSize="11"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="600"
            letterSpacing="2.5px"
          >
            {value}
          </text>
        )}
      </svg>
    </div>
  );
};
