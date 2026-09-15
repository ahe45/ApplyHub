function createDatabaseErrorTranslator({ createHttpError }) {
  return function translateDatabaseError(error) {
    if (error.statusCode) {
      return error;
    }

    if (error.code === "AUTH_SWITCH_PLUGIN_ERROR" || String(error.message || "").includes("auth_gssapi_client")) {
      return createHttpError(
        500,
        "DB 인증 협상에 실패했습니다. Windows의 root/admin 계정을 쓰는 경우 auth_gssapi_client가 잡힐 수 있으니, 먼저 `.env`의 DB 계정 정보가 맞는지 확인하고 필요하면 mysql_native_password 계정을 사용하세요.",
      );
    }

    if (error.code === "ER_BAD_DB_ERROR") {
      return createHttpError(500, "DB가 아직 생성되지 않았습니다. `npm run db:setup`을 먼저 실행하세요.");
    }

    if (error.code === "ER_ACCESS_DENIED_ERROR") {
      return createHttpError(500, "DB 접속 정보가 올바르지 않습니다. `.env`의 계정 정보를 확인하세요.");
    }

    if (error.code === "ECONNREFUSED") {
      return createHttpError(500, "DB 서버에 연결할 수 없습니다. 서비스 실행 여부와 포트를 확인하세요.");
    }

    if (error.cause instanceof Error && !error.code) {
      return createHttpError(400, error.message);
    }

    return createHttpError(500, "서버 처리 중 오류가 발생했습니다.");
  };
}

module.exports = {
  createDatabaseErrorTranslator,
};
