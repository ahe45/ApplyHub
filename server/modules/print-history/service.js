function createPrintHistoryService({
  createHttpError,
  getPool,
}) {
  function normalizeExamineeNoList(examineeNos) {
    const list = Array.isArray(examineeNos) ? examineeNos : [examineeNos];

    return Array.from(
      new Set(
        list
          .map((examineeNo) => String(examineeNo || "").trim())
          .filter(Boolean),
      ),
    );
  }

  async function recordPrintHistory(payload) {
    const examineeNos = normalizeExamineeNoList(
      Array.isArray(payload?.examineeNos) ? payload.examineeNos : payload?.examineeNo,
    );

    if (examineeNos.length === 0) {
      throw createHttpError(400, "출력 대상 수험번호가 필요합니다.");
    }

    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();
      const insertedHistory = [];

      for (const examineeNo of examineeNos) {
        const [examineeRows] = await connection.query(
          `SELECT m.id FROM app_meta m WHERE m.examinee_no = ? AND EXISTS (SELECT 1 FROM app_subm s WHERE s.id = m.id) FOR UPDATE`,
          [examineeNo],
        );

        if (examineeRows.length === 0) {
          throw createHttpError(404, "수험생 정보를 찾을 수 없습니다.");
        }

        await connection.query(
          `INSERT INTO print_log (examinee_no, print_count) VALUES (?, ?)`,
          [examineeNo, 1],
        );
        insertedHistory.push(examineeNo);
      }

      await connection.commit();

      return {
        examineeNo: insertedHistory[0] || "",
        examineeNos: insertedHistory,
        printCount: insertedHistory.length,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return Object.freeze({
    normalizeExamineeNoList,
    recordPrintHistory,
  });
}

module.exports = {
  createPrintHistoryService,
};
