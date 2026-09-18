const nodemailer = require("nodemailer");

const APPLICANT_RESERVED_EMAIL_DOMAINS = Object.freeze([
  "example.com",
  "example.net",
  "example.org",
  "localhost",
]);
const APPLICANT_RESERVED_EMAIL_SUFFIXES = Object.freeze([
  ".example.com",
  ".example.net",
  ".example.org",
  ".test",
  ".invalid",
  ".localhost",
]);

function createDefaultHttpError(statusCode, message, errorCode = "") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function shouldSuppressApplicantVerificationEmail(email = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const [, domain = ""] = normalizedEmail.split("@");

  if (!domain) {
    return false;
  }

  return (
    APPLICANT_RESERVED_EMAIL_DOMAINS.includes(domain) ||
    APPLICANT_RESERVED_EMAIL_SUFFIXES.some((suffix) => domain.endsWith(suffix))
  );
}

function getVerificationSmtpOptions(env = process.env) {
  const host = String(env.SMTP_HOST || "").trim();
  const port = Number(env.SMTP_PORT || 587);
  const user = String(env.SMTP_USER || "").trim();
  const pass = String(env.SMTP_PASS || "");
  const from = String(env.SMTP_FROM || "").trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from || Boolean(user) !== Boolean(pass)) return null;
  const secure = env.SMTP_SECURE == null || env.SMTP_SECURE === "" ? port === 465 : String(env.SMTP_SECURE).toLowerCase() === "true";
  return {
    host, port, secure,
    auth: user ? {user, pass} : undefined,
    requireTLS: !secure,
    tls: {rejectUnauthorized: String(env.SMTP_TLS_REJECT_UNAUTHORIZED || "").toLowerCase() !== "false"},
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  };
}

function createApplicantVerificationEmailSender({
  createHttpError = createDefaultHttpError,
  env = process.env,
  escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
  mailer = nodemailer,
  deliveryEnabled = true,
  allowPreview = false,
} = {}) {
  const smtpFrom = String(env.SMTP_FROM || "").trim();
  const smtpFromName = String(env.SMTP_FROM_NAME || "원서접수시스템").trim();
  const smtpOptions = getVerificationSmtpOptions(env);
  const transporter = deliveryEnabled && smtpOptions ? mailer.createTransport(smtpOptions) : null;
  const previewEnabled = allowPreview && ["development", "test"].includes(String(env.NODE_ENV || "").toLowerCase());
  let transporterVerificationPromise = null;

  async function verifyTransporterAvailability() {
    if (!transporter) {
      throw createHttpError(
        503,
        "이메일 발송 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.",
        "APPLICANT_VERIFICATION_EMAIL_NOT_CONFIGURED",
      );
    }

    if (!transporterVerificationPromise) {
      transporterVerificationPromise = transporter.verify().catch((error) => {
        transporterVerificationPromise = null;
        throw error;
      });
    }

    try {
      await transporterVerificationPromise;
    } catch (error) {
      console.error("Verification SMTP check failed:", error.code || "UNKNOWN", error.responseCode || "");
      throw createHttpError(
        503,
        "인증 메일 발송 서비스를 이용할 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.",
        "APPLICANT_VERIFICATION_EMAIL_NOT_AVAILABLE",
      );
    }
  }

  return async ({ codeValue, email, expiresAt, schoolName = "", purposeLabel = "수험생 접수 이메일 인증", language = "ko" }) => {
    if (!deliveryEnabled && previewEnabled) {
      return {
        deliveryMode: "preview",
        deliveryStatus: "sent",
        debugCode: String(codeValue || "").trim(),
        messageId: `preview:${Date.now()}`,
      };
    }

    const schoolLabel = String(schoolName || "").replace(/[\r\n]+/g, " ").trim();
    const isEnglish = language === "en";
    const serviceLabel = `${schoolLabel ? schoolLabel + " " : ""}${isEnglish ? "Application Portal" : "원서접수"}`;
    const verificationMailSubject = `[ApplyHub] ${serviceLabel} ${isEnglish ? "Email verification code" : "이메일 인증 코드"}`;
    const isPasswordRecovery = purposeLabel === "비밀번호 재설정";
    const heading = isEnglish ? (isPasswordRecovery ? "Reset your password" : "Verify your email") : (isPasswordRecovery ? "비밀번호 재설정" : "이메일 인증");
    const introduction = isEnglish
      ? (isPasswordRecovery ? `Use this code to reset your password for ${serviceLabel}.` : `Use this code to verify your email address for ${serviceLabel}.`)
      : isPasswordRecovery
      ? `${serviceLabel} 시스템의 비밀번호 재설정을 위한 인증번호입니다.`
      : `${serviceLabel} 시스템에서 이메일 주소를 확인하기 위한 인증번호입니다.`;
    const instruction = isEnglish
      ? (isPasswordRecovery ? "Enter the code below on the password reset page." : "Enter the code below on the email verification page.")
      : isPasswordRecovery
      ? "비밀번호 재설정 화면에 아래 인증번호를 입력해 주세요."
      : "진행 중인 인증 화면에 아래 인증번호를 입력해 주세요.";
    const greeting = isEnglish ? "Hello," : "안녕하세요.";
    const codeLabel = isEnglish ? "Verification code" : "인증번호";
    const expiryLabel = isEnglish ? "Expires at" : "유효시간";
    let expirationLabel = "";
    if (expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(expiresAt).map(part => [part.type, part.value]));
      expirationLabel = `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}:${parts.second}${isEnglish ? " (Korea Standard Time, UTC+09:00)" : "까지 (한국시간)"}`;
    }
    const expiryNotice = isEnglish ? "If this code expires, request a new code on the verification page." : "유효시간이 지나면 인증 화면에서 새 인증번호를 요청해 주세요.";
    const securityNotice = isEnglish ? "If you did not request this email, you can safely delete it. Do not share this code with anyone." : "본인이 요청하지 않은 메일이라면 별도의 조치 없이 삭제해 주세요. 인증번호는 다른 사람에게 알려주지 마세요.";
    const textLines = [
      serviceLabel, heading, "", greeting, introduction, instruction, "",
      `${isEnglish ? codeLabel : "인증 코드"}: ${codeValue}`,
      ...(expirationLabel ? [`${expiryLabel}: ${expirationLabel}`] : []),
      expiryNotice, "", securityNotice, "", `ApplyHub · ${serviceLabel}`,
    ];
    const htmlBody = `
      <div lang="${isEnglish ? 'en' : 'ko'}" style="margin:0;padding:24px 12px;background:#f4f7fb;font-family:'Malgun Gothic','Apple SD Gothic Neo',Arial,sans-serif;color:#192e49;line-height:1.7;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe7f1;border-radius:16px;">
          <tr><td style="padding:28px 24px 24px;">
            <p style="margin:0 0 6px;color:#526984;font-size:13px;">${escapeHtml(serviceLabel)}</p>
            <h1 style="margin:0 0 22px;font-size:24px;line-height:1.4;">${heading}</h1>
            <p style="margin:0 0 12px;font-size:14px;">${greeting}<br>${escapeHtml(introduction)}</p>
            <p style="margin:0 0 20px;font-size:14px;">${instruction}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef4ff;border:1px solid #dce7fc;border-radius:12px;">
              <tr><td align="center" style="padding:18px 12px;">
                <div style="font-size:12px;color:#526984;">${codeLabel}</div>
                <div style="margin-top:4px;font-family:Arial,sans-serif;font-size:32px;font-weight:700;letter-spacing:5px;color:#2055ce;">${escapeHtml(codeValue)}</div>
              </td></tr>
            </table>
            ${expirationLabel ? `<p style="margin:14px 0 4px;font-size:12px;color:#526984;">${expiryLabel}: ${escapeHtml(expirationLabel)}</p>` : ""}
            <p style="margin:4px 0 24px;font-size:12px;color:#526984;">${expiryNotice}</p>
            <div style="border-top:1px solid #e4eaf3;padding-top:18px;">
              <p style="margin:0;font-size:12px;color:#64758a;">${securityNotice}</p>
              <p style="margin:16px 0 0;font-size:12px;color:#64758a;">ApplyHub · ${escapeHtml(serviceLabel)}</p>
            </div>
          </td></tr>
        </table>
      </div>`;

    // RFC 2606/6761 reserved domains are used by local smoke tests and should never be sent to a real SMTP server.
    if (previewEnabled && shouldSuppressApplicantVerificationEmail(email)) {
      return {
        deliveryMode: "suppressed",
        deliveryStatus: "sent",
        debugCode: String(codeValue || "").trim(),
        messageId: `suppressed:${Date.now()}`,
      };
    }

    await verifyTransporterAvailability();

    try {
      const sendResult = await transporter.sendMail({
        from: {name: smtpFromName, address: smtpFrom},
        to: {address: email},
        subject: isEnglish && isPasswordRecovery ? `[ApplyHub] ${serviceLabel} Password reset code` : purposeLabel === "수험생 접수 이메일 인증" || isEnglish ? verificationMailSubject : `[원서접수시스템] ${purposeLabel}`,
        text: textLines.join("\n"),
        html: htmlBody,
      });

      if (!Array.isArray(sendResult?.accepted) || sendResult.accepted.length === 0 || sendResult.rejected?.length) {
        throw Object.assign(new Error("SMTP recipient rejected"), {code: "EENVELOPE"});
      }

      return {
        deliveryMode: "smtp",
        deliveryStatus: "sent",
        messageId: String(sendResult?.messageId || "").trim(),
      };
    } catch (error) {
      // Authentication can succeed while the provider rejects the From header at DATA.
      const senderNotAllowed = /no permitted from-header address/i.test(String(error.response || ''));
      console.error("Verification SMTP send failed:", error.code || "UNKNOWN", error.responseCode || "", senderNotAllowed ? "SENDER_NOT_ALLOWED" : "");
      if (senderNotAllowed) {
        throw createHttpError(503, "발신 이메일의 발송 권한이 없어 인증 메일을 보내지 못했습니다. 관리자에게 문의해 주세요.", "APPLICANT_VERIFICATION_EMAIL_SENDER_NOT_ALLOWED");
      }
      throw createHttpError(
        502,
        "인증 메일을 발송하지 못했습니다. 이메일 주소를 확인하고 잠시 후 다시 시도해 주세요.",
        "APPLICANT_VERIFICATION_EMAIL_SEND_FAILED",
      );
    }
  };
}

module.exports = {
  getVerificationSmtpOptions,
  createApplicantVerificationEmailSender,
  shouldSuppressApplicantVerificationEmail,
};
