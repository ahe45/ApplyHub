const { exactRoute, regexRoute } = require("../router");

function decodeRouteParams(groups = {}) {
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [key, decodeURIComponent(String(value || ""))]),
  );
}

function decodeBase64HeaderValue(value = "") {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  try {
    return Buffer.from(normalizedValue, "base64").toString("utf8");
  } catch (error) {
    return "";
  }
}

function decodeBase64JsonArray(value = "") {
  const decodedValue = decodeBase64HeaderValue(value);

  if (!decodedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(decodedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    return [];
  }
}

function createSystemRoutes(deps) {
  function getRequestIpAddress(request) {
    const forwardedHeader = String(request?.headers?.["x-forwarded-for"] || "").trim();

    if (forwardedHeader) {
      return forwardedHeader.split(",")[0].trim();
    }

    return String(request?.socket?.remoteAddress || "").trim();
  }

  function getRequestUserAgent(request) {
    return String(request?.headers?.["user-agent"] || "").trim();
  }

  function buildAuditLogContext(request, authenticatedAccount, entry = {}) {
    return {
      accountId: authenticatedAccount?.id,
      accountName: authenticatedAccount?.name,
      accountRole: authenticatedAccount?.role,
      ipAddress: getRequestIpAddress(request),
      userAgent: getRequestUserAgent(request),
      ...entry,
    };
  }

  async function recordSystemAuditLogSafely(request, authenticatedAccount, entry = {}) {
    if (typeof deps.recordSystemAuditLog !== "function" || !authenticatedAccount) {
      return;
    }

    try {
      await deps.recordSystemAuditLog(buildAuditLogContext(request, authenticatedAccount, entry));
    } catch (error) {
      console.error(`System audit log write failed: ${error.message}`);
    }
  }

  function requireSuperAdmin(authenticatedAccount = null) {
    if (String(authenticatedAccount?.role || "").trim() === deps.superAdminRole) {
      return true;
    }

    throw deps.createHttpError(403, "슈퍼관리자 권한이 필요합니다.", "SUPER_ADMIN_REQUIRED");
  }

  function requireSystemManager(authenticatedAccount = null) {
    const normalizedRole = String(authenticatedAccount?.role || "").trim();

    if (normalizedRole === deps.superAdminRole || normalizedRole === "관리자") {
      return true;
    }

    throw deps.createHttpError(403, "관리자 권한이 필요합니다.", "SYSTEM_MANAGER_REQUIRED");
  }

  function getSystemDataDeleteScopeLabel(scope = "") {
    const normalizedScope = String(scope || "").trim();
    if (normalizedScope === 'applicant-members') return '회원가입 데이터';

    if (normalizedScope === "all") {
      return "전체 데이터";
    }

    if (normalizedScope === "applicant-settings") {
      return "전형 관리 데이터";
    }



    if (normalizedScope === "applicant-history") {
      return "접수 이력 데이터";
    }





    if (normalizedScope === "print-history") {
      return "수험표 출력 이력";
    }

    return normalizedScope || "시스템 데이터";
  }

  return [
    exactRoute('GET', '/api/system-settings/email', async ({response, authenticatedAccount}) => {
      requireSystemManager(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.getEmailSettings(), {'Cache-Control': 'no-store'});
    }),
    exactRoute('PUT', '/api/system-settings/email', async ({request, response, authenticatedAccount}) => {
      requireSystemManager(authenticatedAccount);
      const settings = await deps.updateEmailSettings(await deps.readJsonBody(request));
      await recordSystemAuditLogSafely(request, authenticatedAccount, {
        actionType: 'system_email_settings_update', targetScope: 'system-settings', summaryText: '이메일 발송 설정을 저장했습니다.',
      });
      return deps.sendJson(response, 200, settings);
    }),
    exactRoute('POST', '/api/system-settings/email/check', async ({request, response, authenticatedAccount}) => {
      requireSystemManager(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.checkEmailSettings(await deps.readJsonBody(request)));
    }),
    exactRoute('GET', '/api/public/school-branding', async ({ response }) => {
      const settings = await deps.getSuperAdminSettings();
      return deps.sendJson(response, 200, { schoolName: settings.schoolName, logoImageUrl: settings.logoImageUrl });
    }, { auth: false }),
    exactRoute("GET", "/api/bootstrap", async ({ response, authenticatedAccount }) => {
      const payload = await deps.getBootstrapPayload();
      if (authenticatedAccount?.role !== deps.superAdminRole) {
        payload.accounts = (payload.accounts || []).filter(account => account.role !== deps.superAdminRole);
        delete payload.systemBackupAutomation;
      }
      return deps.sendJson(response, 200, payload);
    }),
    exactRoute("GET", "/api/system-settings", async ({ response, authenticatedAccount }) => {
      requireSystemManager(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.getSystemSettings());
    }),
    exactRoute("GET", "/api/super-admin/settings", async ({ response, authenticatedAccount }) => {
      requireSuperAdmin(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.getSuperAdminSettings());
    }),
    exactRoute("GET", "/api/system-audit-logs", async ({ response, searchParams, authenticatedAccount }) => {
      requireSystemManager(authenticatedAccount);

      const requestedLimit = searchParams?.get("limit") || "";
      const limit = Math.max(1, Math.min(500, Math.round(Number(requestedLimit || 200)) || 200));
      const rows = await deps.getSystemAuditLogs({ limit });

      return deps.sendJson(response, 200, {
        rows,
        limit,
      });
    }),
    exactRoute("GET", "/api/system-backup/automation", async ({ response, authenticatedAccount }) => {
      requireSuperAdmin(authenticatedAccount);
      return deps.sendJson(response, 200, await deps.getSystemBackupAutomationSettings());
    }),
    exactRoute("PUT", "/api/system-backup/automation", async ({ request, response, authenticatedAccount }) => {
      requireSuperAdmin(authenticatedAccount);
      const body = await deps.readJsonBody(request);

      try {
        const settings = await deps.updateSystemBackupAutomationSettings(body);

        await recordSystemAuditLogSafely(request, authenticatedAccount, {
          actionType: "system_backup_auto_settings_update",
          targetScope: "system-backup",
          summaryText: "자동 백업 설정을 저장했습니다.",
          details: {
            enabled: settings.enabled === true,
            scheduleType: settings.scheduleType || "daily",
            weeklyDay: Number(settings.weeklyDay || 0),
            time: settings.time || "",
            retentionCount: Number(settings.retentionCount || 0),
            includeDatabase: settings.includeDatabase !== false,
            includedAssetKeys: Array.isArray(settings.includedAssetKeys) ? settings.includedAssetKeys : [],
          },
        });

        return deps.sendJson(response, 200, settings);
      } catch (error) {
        await recordSystemAuditLogSafely(request, authenticatedAccount, {
          actionType: "system_backup_auto_settings_update_failed",
          targetScope: "system-backup",
          summaryText: "자동 백업 설정 저장에 실패했습니다.",
          details: {
            errorCode: error?.errorCode || "",
            errorMessage: error?.message || "",
          },
        });
        throw error;
      }
    }),
    exactRoute("POST", "/api/system-backup/automation/run", async ({ request, response, authenticatedAccount }) => {
      requireSuperAdmin(authenticatedAccount);
      return deps.sendJson(
        response,
        200,
        await deps.runSystemBackupAutomation(null, {
          trigger: "manual",
          throwOnError: true,
          auditEntryContext: buildAuditLogContext(request, authenticatedAccount),
        }),
      );
    }),
    exactRoute("POST", "/api/system-backup/export", async ({ request, response, authenticatedAccount }) => {
      const body = await deps.readJsonBody(request);
      requireSuperAdmin(authenticatedAccount);

      try {
        await deps.verifySystemDataDeletionPassword(authenticatedAccount?.id, body?.currentPassword);

        const backupArchive = await deps.buildSystemBackupArchive({
          includeDatabase: body?.includeDatabase !== false,
          includedAssetKeys: Array.isArray(body?.includedAssetKeys) ? body.includedAssetKeys : [],
        });

        await recordSystemAuditLogSafely(request, authenticatedAccount, {
          actionType: "system_backup_export",
          targetScope: "system-backup",
          summaryText: "시스템 백업 ZIP을 다운로드했습니다.",
          details: {
            fileName: backupArchive.fileName || "system-backup.zip",
            databaseIncluded: backupArchive?.manifest?.databaseIncluded !== false,
            tableCount: Array.isArray(backupArchive?.manifest?.tables) ? backupArchive.manifest.tables.length : 0,
            selectedAssetKeys: Array.isArray(body?.includedAssetKeys) ? body.includedAssetKeys : [],
          },
        });

        return deps.sendBinary(
          response,
          200,
          {
            "Content-Type": "application/zip",
            "Content-Disposition": deps.buildContentDisposition("attachment", backupArchive.fileName || "system-backup.zip"),
            "Cache-Control": "no-store",
          },
          backupArchive.archiveBuffer,
        );
      } catch (error) {
        await recordSystemAuditLogSafely(request, authenticatedAccount, {
          actionType: "system_backup_export_failed",
          targetScope: "system-backup",
          summaryText: "시스템 백업 ZIP 다운로드에 실패했습니다.",
          details: {
            databaseIncluded: body?.includeDatabase !== false,
            selectedAssetKeys: Array.isArray(body?.includedAssetKeys) ? body.includedAssetKeys : [],
            errorCode: error?.errorCode || "",
            errorMessage: error?.message || "",
          },
        });
        throw error;
      }
    }),
    exactRoute("POST", "/api/system-backup/validate", async ({ request, response, authenticatedAccount }) => {
      requireSuperAdmin(authenticatedAccount);
      const backupArchiveBuffer = await deps.readBinaryBody(request);
      return deps.sendJson(response, 200, await deps.validateSystemBackupArchive(backupArchiveBuffer));
    }),
    exactRoute("POST", "/api/system-backup/import", async ({ request, response, authenticatedAccount }) => {
      requireSuperAdmin(authenticatedAccount);
      const backupArchiveBuffer = await deps.readBinaryBody(request);
      const currentPassword = decodeBase64HeaderValue(request.headers["x-system-backup-password-base64"]);
      const uploadFileName = decodeBase64HeaderValue(request.headers["x-system-backup-file-name-base64"]);
      const selectedRestoreItemKeys = decodeBase64JsonArray(request.headers["x-system-backup-restore-items-base64"]);

      try {
        await deps.verifySystemDataDeletionPassword(authenticatedAccount?.id, currentPassword);

        const restoreResult = await deps.restoreSystemBackupArchive(backupArchiveBuffer, {
          fileName: uploadFileName,
          selectedRestoreItemKeys,
        });

        await recordSystemAuditLogSafely(request, authenticatedAccount, {
          actionType: "system_backup_import",
          targetScope: "system-backup",
          summaryText: "시스템 백업 ZIP을 복원했습니다.",
          details: {
            fileName: uploadFileName || "system-backup.zip",
            selectedRestoreItemKeys,
            restoredDatabase: restoreResult?.restoredDatabase === true,
            restoredTableCount: Number(restoreResult?.restoredTableCount || 0),
            restoredRowCount: Number(restoreResult?.restoredRowCount || 0),
            restoredMembers: Number(restoreResult?.restoredMembers || 0),
            restoredFileCount: Number(restoreResult?.restoredFileCount || 0),
            restoredAssetKeys: Array.isArray(restoreResult?.restoredAssetKeys) ? restoreResult.restoredAssetKeys : [],
          },
        });

        return deps.sendJson(response, 200, restoreResult);
      } catch (error) {
        await recordSystemAuditLogSafely(request, authenticatedAccount, {
          actionType: "system_backup_import_failed",
          targetScope: "system-backup",
          summaryText: "시스템 백업 ZIP 복원에 실패했습니다.",
          details: {
            fileName: uploadFileName || "system-backup.zip",
            selectedRestoreItemKeys,
            errorCode: error?.errorCode || "",
            errorMessage: error?.message || "",
          },
        });
        throw error;
      }
    }),
    exactRoute("PUT", "/api/login-notice", async ({ request, response, authenticatedAccount }) => {
      requireSystemManager(authenticatedAccount);
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.updateLoginNoticeHtml(body));
    }),
    exactRoute("PUT", "/api/system-settings", async ({ request, response, authenticatedAccount }) => {
      requireSystemManager(authenticatedAccount);
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.updateSystemSettings(body));
    }),
    regexRoute(
      "POST",
      /^\/api\/super-admin\/assets\/(?<field>logoImageUrl|backgroundImageUrl)$/,
      async ({ request, response, params, searchParams, authenticatedAccount }) => {
        requireSuperAdmin(authenticatedAccount);
        const fileBuffer = await deps.readBinaryBody(request);

        return deps.sendJson(
          response,
          201,
          await deps.uploadSuperAdminImage(params.field, fileBuffer, {
            fileName: searchParams?.get("fileName") || "",
            mimeType: request.headers["content-type"] || "",
            replaceUrl: searchParams?.get("replaceUrl") || "",
          }),
        );
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
    exactRoute("PUT", "/api/super-admin/settings", async ({ request, response, authenticatedAccount }) => {
      requireSuperAdmin(authenticatedAccount);
      const body = await deps.readJsonBody(request);
      return deps.sendJson(response, 200, await deps.updateSuperAdminSettings(body));
    }),
    regexRoute(
      "DELETE",
      /^\/api\/system-data\/(?<scope>all|applicant-members|applicant-settings|applicant-history|print-history)$/,
      async ({ request, response, params, authenticatedAccount }) => {
        requireSystemManager(authenticatedAccount);
        const body = await deps.readJsonBody(request);

        try {
          if (['all', 'applicant-members'].includes(String(params.scope || ''))) {
            await deps.verifySystemDataDeletionPassword(authenticatedAccount?.id, body?.currentPassword);
          }

          const deleteResult = await deps.deleteSystemData(params.scope);

          await recordSystemAuditLogSafely(request, authenticatedAccount, {
            actionType: "system_data_delete",
            targetScope: String(params.scope || "").trim(),
            summaryText: `${getSystemDataDeleteScopeLabel(params.scope)}를 삭제했습니다.`,
            details: deleteResult,
          });

          return deps.sendJson(response, 200, deleteResult);
        } catch (error) {
          await recordSystemAuditLogSafely(request, authenticatedAccount, {
            actionType: "system_data_delete_failed",
            targetScope: String(params.scope || "").trim(),
            summaryText: `${getSystemDataDeleteScopeLabel(params.scope)} 삭제에 실패했습니다.`,
            details: {
              errorCode: error?.errorCode || "",
              errorMessage: error?.message || "",
            },
          });
          throw error;
        }
      },
      { getParams: (match) => decodeRouteParams(match.groups) },
    ),
  ];
}

module.exports = {
  createSystemRoutes,
};
