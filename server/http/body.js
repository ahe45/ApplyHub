async function readJsonBody(request, { maxBytes = 30 * 1024 * 1024 } = {}) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('요청 데이터 크기 제한을 초과했습니다.'), { statusCode: 413 });
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch (error) {
    const parseError = new Error("JSON 본문을 해석할 수 없습니다.");
    parseError.cause = error;
    throw parseError;
  }
}

async function readBinaryBody(request, { maxBytes = 256 * 1024 * 1024 } = {}) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('파일 크기 제한을 초과했습니다.'), { statusCode: 413 });
    chunks.push(chunk);
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
}

module.exports = {
  readBinaryBody,
  readJsonBody,
};
