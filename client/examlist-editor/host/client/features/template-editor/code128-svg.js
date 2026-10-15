const code128Patterns = Object.freeze([
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
]);

const code128StartB = 104;
const code128Stop = 106;
const defaultCode128Value = "123100001";

function escapeSvgAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatSvgNumber(value) {
  const roundedValue = Math.round(Number(value) * 1000) / 1000;

  return Number.isFinite(roundedValue) ? String(roundedValue) : "0";
}

export function normalizeCode128BValue(value) {
  const text = String(value ?? "").trim() || defaultCode128Value;
  const normalizedText = Array.from(text)
    .map((character) => {
      const codePoint = character.charCodeAt(0);

      return codePoint >= 32 && codePoint <= 127 ? character : "?";
    })
    .join("");

  return normalizedText || defaultCode128Value;
}

export function buildCode128BSequence(value) {
  const normalizedValue = normalizeCode128BValue(value);
  const dataCodes = Array.from(normalizedValue, (character) => character.charCodeAt(0) - 32);
  const checksum =
    (code128StartB + dataCodes.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;

  return {
    checksum,
    sequence: [code128StartB, ...dataCodes, checksum, code128Stop],
    value: normalizedValue,
  };
}

export function buildCode128Svg(value, options = {}) {
  const width = Number(options.width) > 0 ? Number(options.width) : 240;
  const height = Number(options.height) > 0 ? Number(options.height) : 72;
  const quietZoneModules = 10;
  const barColor = String(options.barColor || "#000000");
  const backgroundColor = String(options.backgroundColor || "#ffffff");
  const { checksum, sequence, value: normalizedValue } = buildCode128BSequence(value);
  const barcodeModuleCount = sequence.reduce((sum, code) => {
    const pattern = code128Patterns[code] || "";

    return (
      sum +
      pattern.split("").reduce((patternSum, widthCharacter) => patternSum + Number(widthCharacter || 0), 0)
    );
  }, 0);
  const moduleWidth = width / Math.max(barcodeModuleCount + quietZoneModules * 2, 1);
  let cursorX = quietZoneModules * moduleWidth;
  const bars = sequence
    .flatMap((code) => {
      const pattern = code128Patterns[code] || "";

      return pattern.split("").map((widthCharacter, index) => {
        const partWidth = Number(widthCharacter) * moduleWidth;
        const x = cursorX;
        cursorX += partWidth;

        if (index % 2 !== 0) {
          return "";
        }

        return `<rect x="${formatSvgNumber(x)}" y="0" width="${formatSvgNumber(partWidth)}" height="${formatSvgNumber(height)}" fill="${escapeSvgAttribute(barColor)}" />`;
      });
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" viewBox="0 0 ${formatSvgNumber(width)} ${formatSvgNumber(height)}" preserveAspectRatio="none" fill="none" shape-rendering="crispEdges" data-code128-format="code128" data-code128-start="B" data-code128-checksum="${checksum}" data-code128-sequence="${escapeSvgAttribute(sequence.join(","))}" data-code128-value="${escapeSvgAttribute(normalizedValue)}">
      <rect width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="${escapeSvgAttribute(backgroundColor)}"/>
      ${bars}
    </svg>
  `;
}
