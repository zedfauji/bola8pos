/**
 * POOL TABLE ILLUSTRATION
 *
 * Pure SVG component — no side effects, no hooks.
 * Renders a top-down pool table illustration with state-specific visuals.
 */

import type { PoolTable } from '@shared/lib/domain';
import { formatMoney } from '@shared/lib/domain-helpers';

type PoolTableStatus = PoolTable['status'];

export interface PoolTableIllustrationProps {
  status: PoolTableStatus;
  /** ≥ 2h session → warm brown felt */
  isOvertime: boolean | undefined;
  /** Shows timer + charge overlay when occupied */
  timer: { totalSeconds: number; currentCharge: number } | undefined;
  /** Shows "$X.XX/hr" label when available */
  ratePerHour: number | undefined;
}

// ── Colour palette helpers ────────────────────────────────────────────────────

interface FeltColors {
  felt: string;
  cushion: string;
}

function getFeltColors(status: PoolTableStatus, isOvertime: boolean | undefined): FeltColors {
  if (status === 'occupied' && isOvertime) {
    return { felt: '#7a3f1f', cushion: '#4f2814' };
  }
  if (status === 'reserved') {
    return { felt: '#2a5aa8', cushion: '#1a3d72' };
  }
  if (status === 'maintenance') {
    return { felt: '#4a4a4a', cushion: '#2f2f2f' };
  }
  // available or occupied (normal)
  return { felt: '#1f7a3d', cushion: '#154f29' };
}

// ── Timer formatter (00:00:00) ────────────────────────────────────────────────

function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CueStick() {
  return (
    <g transform="translate(40 120) rotate(-18)">
      {/* Shaft */}
      <rect x={0} y={-1.5} width={200} height={3} rx={1} fill="#b97a3e" />
      {/* Butt (overlaid darker section at base) */}
      <rect x={0} y={-1.5} width={80} height={3} rx={1} fill="#8a502b" />
      {/* Tip */}
      <rect x={0} y={-1.5} width={6} height={3} rx={1} fill="#e8d7a3" />
      {/* Cap */}
      <rect x={196} y={-2} width={4} height={4} rx={1} fill="#1a1a1a" />
    </g>
  );
}

interface BallProps {
  cx: number;
  cy: number;
  color: string;
  number: number | null;
}

function Ball({ cx, cy, color, number }: BallProps) {
  return (
    <g>
      {/* Main circle */}
      <circle cx={cx} cy={cy} r={7} fill={color} />
      {/* White center disc (stripe/solid indicator) */}
      {number !== null && <circle cx={cx} cy={cy} r={3} fill="#fff" />}
      {/* Number */}
      {number !== null && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={3.5}
          fontFamily="'Geist Mono', monospace"
          fontWeight={700}
          fill="#111"
        >
          {number}
        </text>
      )}
      {/* Outline */}
      <circle cx={cx} cy={cy} r={7} fill="none" stroke="#000" strokeWidth={0.5} opacity={0.25} />
      {/* Highlight */}
      <circle cx={cx - 2} cy={cy - 2} r={1.5} fill="#fff" opacity={0.6} />
    </g>
  );
}

function NineBallRack() {
  return (
    <g>
      {/* 9-ball diamond rack layout */}
      <Ball cx={200} cy={85} color="#f5d042" number={1} />
      <Ball cx={213} cy={79} color="#1b4fa5" number={2} />
      <Ball cx={213} cy={91} color="#c0392b" number={3} />
      <Ball cx={226} cy={73} color="#4b2a7a" number={4} />
      <Ball cx={226} cy={85} color="#111" number={8} />
      <Ball cx={226} cy={97} color="#1f8c4a" number={6} />
      {/* Cue ball — no number */}
      <Ball cx={90} cy={85} color="#fafafa" number={null} />
    </g>
  );
}

function MaintenanceSash() {
  return (
    <g transform="translate(150 85) rotate(-6)">
      <rect x={-72} y={-11} width={144} height={22} rx={3} fill="#eab308" />
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontFamily="'Geist Mono', monospace"
        fontWeight={700}
        fill="#111"
        letterSpacing={1}
      >
        OUT OF SERVICE
      </text>
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PoolTableIllustration({
  status,
  isOvertime,
  timer,
  ratePerHour,
}: PoolTableIllustrationProps) {
  const { felt: feltColor, cushion: cushionColor } = getFeltColors(status, isOvertime);
  const isMaintenance = status === 'maintenance';

  return (
    <div className="relative w-full">
      <svg
        viewBox="0 0 300 170"
        width="100%"
        aria-hidden="true"
        style={isMaintenance ? { filter: 'saturate(0.4) brightness(0.9)' } : undefined}
      >
        <defs>
          {/* Wood grain gradient — vertical */}
          <linearGradient id="pool-wood-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b3f1e" />
            <stop offset="50%" stopColor="#4a2a12" />
            <stop offset="100%" stopColor="#2f1a09" />
          </linearGradient>

          {/* Felt gradient — vertical, slight fade at bottom */}
          <linearGradient id="pool-felt-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={feltColor} stopOpacity={1} />
            <stop offset="100%" stopColor={feltColor} stopOpacity={0.85} />
          </linearGradient>

          {/* Pocket radial gradient */}
          <radialGradient id="pool-pocket-grad" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#000" />
            <stop offset="70%" stopColor="#000" />
            <stop offset="100%" stopColor="#1a0d05" />
          </radialGradient>
        </defs>

        {/* Layer 1 — Rail */}
        <rect
          x={2}
          y={2}
          width={296}
          height={166}
          rx={22}
          fill="url(#pool-wood-grad)"
          stroke="#1e0f06"
          strokeWidth={1}
        />

        {/* Layer 2 — Rail highlight */}
        <rect x={2} y={2} width={296} height={14} rx={22} fill="#8a542c" opacity={0.35} />

        {/* Layer 3 — Cushion */}
        <rect x={18} y={18} width={264} height={134} rx={10} fill={cushionColor} />

        {/* Layer 4 — Felt */}
        <rect x={26} y={26} width={248} height={118} rx={6} fill="url(#pool-felt-grad)" />

        {/* Layer 5 — Felt lines */}
        <line
          x1={26}
          y1={60}
          x2={274}
          y2={60}
          stroke={cushionColor}
          strokeWidth={0.5}
          opacity={0.15}
        />
        <line
          x1={26}
          y1={110}
          x2={274}
          y2={110}
          stroke={cushionColor}
          strokeWidth={0.5}
          opacity={0.15}
        />

        {/* Layer 6 — Foot spot */}
        <circle cx={200} cy={85} r={1.5} fill="#fff" opacity={0.4} />

        {/* Layer 7 — Head string */}
        <line
          x1={100}
          y1={26}
          x2={100}
          y2={144}
          stroke="#fff"
          strokeWidth={0.5}
          opacity={0.25}
          strokeDasharray="2 3"
        />

        {/* Layer 8 — Pockets */}
        {/* Top-left */}
        <circle
          cx={22}
          cy={22}
          r={11}
          fill="url(#pool-pocket-grad)"
          stroke="#120804"
          strokeWidth={1}
        />
        {/* Top-center */}
        <circle
          cx={150}
          cy={18}
          r={11}
          fill="url(#pool-pocket-grad)"
          stroke="#120804"
          strokeWidth={1}
        />
        {/* Top-right */}
        <circle
          cx={278}
          cy={22}
          r={11}
          fill="url(#pool-pocket-grad)"
          stroke="#120804"
          strokeWidth={1}
        />
        {/* Bottom-left */}
        <circle
          cx={22}
          cy={148}
          r={11}
          fill="url(#pool-pocket-grad)"
          stroke="#120804"
          strokeWidth={1}
        />
        {/* Bottom-center */}
        <circle
          cx={150}
          cy={152}
          r={11}
          fill="url(#pool-pocket-grad)"
          stroke="#120804"
          strokeWidth={1}
        />
        {/* Bottom-right */}
        <circle
          cx={278}
          cy={148}
          r={11}
          fill="url(#pool-pocket-grad)"
          stroke="#120804"
          strokeWidth={1}
        />

        {/* Conditional content */}
        {status === 'available' && <CueStick />}
        {status === 'occupied' && <NineBallRack />}
        {status === 'maintenance' && <MaintenanceSash />}
      </svg>

      {/* Occupied overlay — timer + charge, centered */}
      {status === 'occupied' && timer !== undefined && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
        >
          <span className="font-mono text-2xl tracking-wide text-white">
            {formatSeconds(timer.totalSeconds)}
          </span>
          <span className="font-mono text-sm text-white">${formatMoney(timer.currentCharge)}</span>
        </div>
      )}

      {/* Available overlay — rate label, bottom-right */}
      {status === 'available' && ratePerHour !== undefined && (
        <div className="pointer-events-none absolute bottom-2 right-3">
          <span className="font-mono text-[11px] text-white/70">
            ${formatMoney(ratePerHour)}/hr
          </span>
        </div>
      )}
    </div>
  );
}
