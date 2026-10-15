const bwipjs = require("bwip-js");
const QRCode = require("qrcode");
const { getObjectValue } = require('../../../../shared/domain/template-data');

const TEMPLATE_GENERATED_OBJECT_ALT_SUFFIX = Object.freeze({
  barcode: "Code128 바코드",
  qrcode: "QR코드",
});

function createTemplateGeneratedObjectService({
  createHttpError,
  setHtmlTagAttribute,
}) {
  async function buildTemplateGeneratedObjectSvg(objectType, rawValue) {
    const normalizedType = String(objectType || "").trim().toLowerCase();
    const value = String(rawValue ?? "").trim() || "-";

    if (normalizedType === "barcode") {
      return bwipjs.toSVG({
        bcid: "code128",
        text: value,
        scale: 2,
        height: 12,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
        backgroundcolor: "FFFFFF",
      });
    }

    if (normalizedType === "qrcode") {
      return QRCode.toString(value, {
        type: "svg",
        margin: 0,
        width: 168,
        errorCorrectionLevel: "M",
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });
    }

    throw createHttpError(400, "지원하지 않는 개체 타입입니다.");
  }

  function buildTemplateGeneratedObjectDataUri(svgMarkup) {
    return `data:image/svg+xml;base64,${Buffer.from(String(svgMarkup || ""), "utf8").toString("base64")}`;
  }

  async function replaceTemplateGeneratedObjectMarkup(markup, examinee) {
    const objectPattern = /<img\b[^>]*\bdata-template-object-type=(["'])(barcode|qrcode)\1[^>]*>/gi;
    const matches = Array.from(String(markup || "").matchAll(objectPattern));

    if (matches.length === 0) {
      return String(markup || "");
    }

    const replacementTags = await Promise.all(
      matches.map(async (match) => {
        const objectType = match[2];
        const source = /\bdata-template-object-source=(["'])([^"']*)\1/i.exec(match[0])?.[2] || 'examineeNo';
        const objectValue = getObjectValue(examinee, source);
        const svgMarkup = await buildTemplateGeneratedObjectSvg(objectType, objectValue);
        let nextTagMarkup = setHtmlTagAttribute(match[0], "src", buildTemplateGeneratedObjectDataUri(svgMarkup));
        nextTagMarkup = setHtmlTagAttribute(
          nextTagMarkup,
          "alt",
          `${objectValue} ${TEMPLATE_GENERATED_OBJECT_ALT_SUFFIX[objectType] || "개체"}`,
        );
        return nextTagMarkup;
      }),
    );

    let cursor = 0;
    let replacementIndex = 0;
    let nextMarkup = "";

    matches.forEach((match) => {
      nextMarkup += markup.slice(cursor, match.index);
      nextMarkup += replacementTags[replacementIndex];
      cursor = match.index + match[0].length;
      replacementIndex += 1;
    });

    nextMarkup += markup.slice(cursor);
    return nextMarkup;
  }

  return Object.freeze({
    buildTemplateGeneratedObjectSvg,
    replaceTemplateGeneratedObjectMarkup,
  });
}

module.exports = {
  createTemplateGeneratedObjectService,
};
