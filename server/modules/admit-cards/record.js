function normalizeExamineeRecord(record = {}) {
  const track = String(record.track ?? "").trim();
  const admission = String(record.admission ?? record.exam ?? "").trim();
  const admissionCode = String(record.admissionCode ?? "").trim();
  const series = String(record.series ?? "").trim();
  const seriesCode = String(record.seriesCode ?? "").trim();
  const unit = String(record.unit ?? record.unitName ?? "").trim();
  const unitCode = String(record.unitCode ?? "").trim();
  const major = String(record.major ?? "").trim();
  const majorCode = String(record.majorCode ?? "").trim();
  const examineeNo = String(record.examineeNo ?? "").trim();

  return {
    ...record,
    track,
    admission,
    exam: admission,
    admissionCode,
    series,
    seriesCode,
    unit,
    unitCode,
    major,
    majorCode,
    examineeNo,
  };
}

module.exports = {
  normalizeExamineeRecord,
};
