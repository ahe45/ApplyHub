import { buildCode128Svg } from "./code128-svg.js";
import { normalizeGeneratedObjectType } from "./generated-objects-config.js";

export function createGeneratedObjectSvgDataUrl(svgMarkup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(String(svgMarkup || ""))}`;
}

export function buildGeneratedObjectSvg(objectType, objectValue, sourceKey = "") {
  const normalizedType = normalizeGeneratedObjectType(objectType);
  let normalizedValue = String(objectValue || "123100001").trim() || "123100001";
  if (normalizedType === "barcode" && sourceKey === "candidate.examDate") {
    normalizedValue = normalizedValue.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1$2$3");
  }

  if (normalizedType === "qrcode") {
    const size = 29;
    const cellSize = 4;
    const quietZone = 0;
    const svgSize = size * cellSize + quietZone * 2;
    const seed = normalizedValue.split("").reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 1), 0);
    const finderCells = new Set();

    [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ].forEach(([startX, startY]) => {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const isOuter = x === 0 || x === 6 || y === 0 || y === 6;
          const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;

          if (isOuter || isInner) {
            finderCells.add(`${startX + x}:${startY + y}`);
          }
        }
      }
    });

    const contentCells = [];

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const cellKey = `${x}:${y}`;

        if (finderCells.has(cellKey)) {
          continue;
        }

        const shouldFill = ((x * 17 + y * 31 + seed) % 7 < 3) || ((x + y + seed) % 13 === 0);

        if (shouldFill) {
          contentCells.push(
            `<rect x="${quietZone + x * cellSize}" y="${quietZone + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000000" />`,
          );
        }
      }
    }

    const finderMarkup = Array.from(finderCells)
      .map((cellKey) => {
        const [x, y] = cellKey.split(":").map(Number);

        return `<rect x="${quietZone + x * cellSize}" y="${quietZone + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000000" />`;
      })
      .join("");

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" fill="none">
        <rect width="${svgSize}" height="${svgSize}" fill="#ffffff"/>
        ${finderMarkup}
        ${contentCells.join("")}
      </svg>
    `;
  }

  return buildCode128Svg(normalizedValue);
}
