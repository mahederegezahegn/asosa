/**
 * Code 128 (Set B) Standard 1D Barcode Generator
 * Generates valid SVG vectors for standard 1D barcode scanners and visual display.
 */

// Code 128 patterns: each element represents the width of bars and spaces [b1, s1, b2, s2, b3, s3]
// summing to 11 modules per character (Stop pattern has 13 modules)
const CODE128_PATTERNS: number[][] = [
  [2, 1, 2, 2, 2, 2], // 0: ' '
  [2, 2, 2, 1, 2, 2], // 1: '!'
  [2, 2, 2, 2, 2, 1], // 2: '"'
  [1, 2, 1, 2, 2, 3], // 3: '#'
  [1, 2, 1, 3, 2, 2], // 4: '$'
  [1, 3, 1, 2, 2, 2], // 5: '%'
  [1, 2, 2, 2, 1, 3], // 6: '&'
  [1, 2, 2, 3, 1, 2], // 7: '\''
  [1, 3, 2, 2, 1, 2], // 8: '('
  [2, 2, 1, 2, 1, 3], // 9: ')'
  [2, 2, 1, 3, 1, 2], // 10: '*'
  [2, 3, 1, 2, 1, 2], // 11: '+'
  [1, 1, 2, 2, 3, 2], // 12: ','
  [1, 2, 2, 1, 3, 2], // 13: '-'
  [1, 2, 2, 2, 3, 1], // 14: '.'
  [1, 1, 3, 2, 2, 2], // 15: '/'
  [1, 2, 3, 1, 2, 2], // 16: '0'
  [1, 2, 3, 2, 2, 1], // 17: '1'
  [2, 2, 3, 2, 1, 1], // 18: '2'
  [2, 2, 1, 1, 3, 2], // 19: '3'
  [2, 2, 1, 2, 3, 1], // 20: '4'
  [2, 1, 3, 2, 1, 2], // 21: '5'
  [2, 2, 3, 1, 1, 2], // 22: '6'
  [3, 1, 2, 1, 3, 1], // 23: '7'
  [3, 1, 1, 2, 2, 2], // 24: '8'
  [3, 2, 1, 1, 2, 2], // 25: '9'
  [3, 2, 1, 2, 2, 1], // 26: ':'
  [3, 1, 2, 2, 1, 2], // 27: ';'
  [3, 2, 2, 1, 1, 2], // 28: '<'
  [3, 2, 2, 2, 1, 1], // 29: '='
  [2, 1, 2, 1, 2, 3], // 30: '>'
  [2, 1, 2, 3, 2, 1], // 31: '?'
  [2, 3, 2, 1, 2, 1], // 32: '@'
  [1, 1, 1, 3, 2, 3], // 33: 'A'
  [1, 3, 1, 1, 2, 3], // 34: 'B'
  [1, 3, 1, 3, 2, 1], // 35: 'C'
  [1, 1, 2, 3, 1, 3], // 36: 'D'
  [1, 3, 2, 1, 1, 3], // 37: 'E'
  [1, 3, 2, 3, 1, 1], // 38: 'F'
  [2, 1, 1, 3, 1, 3], // 39: 'G'
  [2, 3, 1, 1, 1, 3], // 40: 'H'
  [2, 3, 1, 3, 1, 1], // 41: 'I'
  [1, 1, 2, 1, 3, 3], // 42: 'J'
  [1, 1, 2, 3, 3, 1], // 43: 'K'
  [1, 3, 2, 1, 3, 1], // 44: 'L'
  [1, 1, 3, 1, 2, 3], // 45: 'M'
  [1, 1, 3, 3, 2, 1], // 46: 'N'
  [1, 3, 3, 1, 2, 1], // 47: 'O'
  [3, 1, 3, 1, 2, 1], // 48: 'P'
  [2, 1, 1, 3, 3, 1], // 49: 'Q'
  [2, 3, 1, 1, 3, 1], // 50: 'R'
  [2, 1, 3, 1, 1, 3], // 51: 'S'
  [2, 1, 3, 3, 1, 1], // 52: 'T'
  [2, 1, 3, 1, 3, 1], // 53: 'U'
  [3, 1, 1, 1, 2, 3], // 54: 'V'
  [3, 1, 1, 3, 2, 1], // 55: 'W'
  [3, 3, 1, 1, 2, 1], // 56: 'X'
  [3, 1, 2, 1, 1, 3], // 57: 'Y'
  [3, 1, 2, 3, 1, 1], // 58: 'Z'
  [3, 3, 2, 1, 1, 1], // 59: '['
  [3, 1, 4, 1, 1, 1], // 60: '\\'
  [2, 2, 1, 4, 1, 1], // 61: ']'
  [4, 3, 1, 1, 1, 1], // 62: '^'
  [1, 1, 1, 2, 2, 4], // 63: '_'
  [1, 1, 1, 4, 2, 2], // 64: '`'
  [1, 2, 1, 1, 2, 4], // 65: 'a'
  [1, 2, 1, 4, 2, 1], // 66: 'b'
  [1, 4, 1, 1, 2, 2], // 67: 'c'
  [1, 4, 1, 2, 2, 1], // 68: 'd'
  [1, 1, 2, 2, 1, 4], // 69: 'e'
  [1, 1, 2, 4, 1, 2], // 70: 'f'
  [1, 2, 2, 1, 1, 4], // 71: 'g'
  [1, 2, 2, 4, 1, 1], // 72: 'h'
  [1, 4, 2, 1, 1, 2], // 73: 'i'
  [1, 4, 2, 2, 1, 1], // 74: 'j'
  [2, 4, 1, 2, 1, 1], // 75: 'k'
  [2, 2, 1, 1, 1, 4], // 76: 'l'
  [4, 1, 3, 1, 1, 1], // 77: 'm'
  [2, 4, 1, 1, 1, 2], // 78: 'n'
  [1, 3, 4, 1, 1, 1], // 79: 'o'
  [1, 1, 1, 2, 4, 2], // 80: 'p'
  [1, 2, 1, 1, 4, 2], // 81: 'q'
  [1, 2, 1, 2, 4, 1], // 82: 'r'
  [1, 1, 4, 2, 1, 2], // 83: 's'
  [1, 2, 4, 1, 1, 2], // 84: 't'
  [1, 2, 4, 2, 1, 1], // 85: 'u'
  [4, 1, 1, 2, 1, 2], // 86: 'v'
  [4, 2, 1, 1, 1, 2], // 87: 'w'
  [4, 2, 1, 2, 1, 1], // 88: 'x'
  [2, 1, 2, 1, 4, 1], // 89: 'y'
  [2, 1, 4, 1, 2, 1], // 90: 'z'
  [4, 1, 2, 1, 2, 1], // 91: '{'
  [1, 1, 1, 1, 4, 3], // 92: '|'
  [1, 1, 1, 3, 4, 1], // 93: '}'
  [1, 3, 1, 1, 4, 1], // 94: '~'
  [1, 1, 4, 1, 1, 3], // 95: DEL
  [1, 1, 4, 3, 1, 1], // 96: FNC3
  [4, 1, 1, 1, 1, 3], // 97: FNC2
  [4, 1, 1, 3, 1, 1], // 98: SHIFT
  [1, 1, 3, 1, 4, 1], // 99: CODE C
  [1, 1, 4, 1, 3, 1], // 100: CODE B
  [3, 1, 1, 1, 4, 1], // 101: FNC4
  [4, 1, 1, 1, 3, 1], // 102: FNC1
  [2, 1, 1, 4, 1, 2], // 103: START A
  [2, 1, 1, 2, 1, 4], // 104: START B
  [2, 1, 1, 2, 3, 2], // 105: START C
];

const STOP_PATTERN = [2, 3, 3, 1, 1, 1, 2]; // 106: STOP (7 segments)

/**
 * Encodes an ASCII string using Code 128 (Subset B)
 * Returns array of module widths where alternating indices are bars (true) and spaces (false)
 */
export function encodeCode128B(text: string): boolean[] {
  const safeText = text || 'STU-0000-0000';
  const startCode = 104; // Start B
  const codes: number[] = [startCode];

  for (let i = 0; i < safeText.length; i++) {
    const charCode = safeText.charCodeAt(i);
    // In Set B, characters 32 through 127 map to values 0 through 95
    if (charCode >= 32 && charCode <= 126) {
      codes.push(charCode - 32);
    } else {
      // Default fallback for out-of-range to space
      codes.push(0);
    }
  }

  // Calculate checksum: (startCode + sum(code[i] * i)) mod 103
  let checksum = startCode;
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i;
  }
  const checkDigit = checksum % 103;
  codes.push(checkDigit);

  // Convert codes into boolean modules (true = bar, false = space)
  const modules: boolean[] = [];

  // Quiet zone: 10 modules
  for (let q = 0; q < 10; q++) modules.push(false);

  // Encode data codes
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (pattern) {
      for (let p = 0; p < pattern.length; p++) {
        const width = pattern[p];
        const isBar = p % 2 === 0;
        for (let w = 0; w < width; w++) {
          modules.push(isBar);
        }
      }
    }
  }

  // Encode STOP code
  for (let p = 0; p < STOP_PATTERN.length; p++) {
    const width = STOP_PATTERN[p];
    const isBar = p % 2 === 0;
    for (let w = 0; w < width; w++) {
      modules.push(isBar);
    }
  }

  // Trailing quiet zone: 10 modules
  for (let q = 0; q < 10; q++) modules.push(false);

  return modules;
}

/**
 * Returns optimized SVG rects for the barcode
 */
export function generateBarcodeRectangles(modules: boolean[], moduleWidth = 2, height = 64) {
  const rects: { x: number; width: number; height: number }[] = [];
  let currentBarStart: number | null = null;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i]) {
      if (currentBarStart === null) {
        currentBarStart = i;
      }
    } else {
      if (currentBarStart !== null) {
        rects.push({
          x: currentBarStart * moduleWidth,
          width: (i - currentBarStart) * moduleWidth,
          height,
        });
        currentBarStart = null;
      }
    }
  }

  if (currentBarStart !== null) {
    rects.push({
      x: currentBarStart * moduleWidth,
      width: (modules.length - currentBarStart) * moduleWidth,
      height,
    });
  }

  const totalWidth = modules.length * moduleWidth;
  return { rects, totalWidth, height };
}
