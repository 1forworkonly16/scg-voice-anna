// Python-compatible rounding, so quote.ts matches info/data/price_model_reference.py exactly.
//
// Python's round() rounds the EXACT binary value of a float and breaks exact ties to the EVEN
// neighbour ("banker's rounding"): round(5742.5) = 5742, round(6542.5) = 6542, round(0.5) = 0.
// JavaScript's Math.round() breaks ties upward and toFixed() has its own rules, so neither is usable.

/** Python round(x): nearest integer, exact ties to even. Returns an integer-valued number. */
export function roundHalfEven(x: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`roundHalfEven: non-finite ${x}`);
  const f = Math.floor(x);
  const diff = x - f; // exact: x and f are within a factor of 2 of each other (or f = 0)
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function decompose(x: number): { mant: bigint; exp: number } {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const expBits = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let exp: number;
  if (expBits === 0) {
    exp = -1074; // subnormal
  } else {
    mant |= 1n << 52n;
    exp = expBits - 1075;
  }
  return { mant, exp };
}

/**
 * Python round(x, ndigits) for ndigits >= 0: exact half-even rounding of the BINARY value
 * (so round(2.675, 2) = 2.67 because the double is slightly below 2.675, and round(0.125, 2) = 0.12).
 */
export function roundHalfEvenN(x: number, ndigits: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`roundHalfEvenN: non-finite ${x}`);
  if (!Number.isInteger(ndigits) || ndigits < 0 || ndigits > 15) throw new RangeError(`bad ndigits ${ndigits}`);
  if (ndigits === 0) return roundHalfEven(x);
  if (x === 0) return x;
  const neg = x < 0;
  const { mant, exp } = decompose(Math.abs(x));
  const scale = 10n ** BigInt(ndigits);
  let num: bigint;
  let den: bigint;
  if (exp >= 0) {
    num = mant * scale * (1n << BigInt(exp));
    den = 1n;
  } else {
    num = mant * scale;
    den = 1n << BigInt(-exp);
  }
  let q = num / den;
  const twiceRem = 2n * (num - q * den);
  if (twiceRem > den || (twiceRem === den && (q & 1n) === 1n)) q += 1n;
  // q / 10^n with both operands exact doubles is correctly rounded, which is what Python returns.
  const res = Number(q) / Number(scale);
  return neg ? -res : res;
}
