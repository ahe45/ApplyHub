import {
  generatedObjectPreviewValues,
  generatedObjectSourceAliases,
  normalizeGeneratedObjectSourceKey,
} from "./generated-objects-config.js";

export function uniqueGeneratedObjectValues(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

export function getGeneratedObjectSourceOptions(tagDefinitions = []) {
  const options = (Array.isArray(tagDefinitions) ? tagDefinitions : [])
    .filter((definition) => String(definition?.type || "").trim().toLowerCase() !== "image")
    .map((definition) => {
      const key = normalizeGeneratedObjectSourceKey(definition?.key || definition?.dataKey || definition?.token);

      return {
        example: String(definition?.example || generatedObjectPreviewValues[key] || ""),
        key,
        label: String(definition?.label || key).trim() || key,
      };
    })
    .filter((definition) => definition.key);
  const hasExamNo = options.some((definition) => definition.key === "candidate.examNo");

  return hasExamNo
    ? options
    : [
        {
          example: generatedObjectPreviewValues["candidate.examNo"],
          key: "candidate.examNo",
          label: "수험번호",
        },
        ...options,
      ];
}

export function getGeneratedObjectSourceLabel(sourceKey, tagDefinitions = []) {
  const normalizedSourceKey = normalizeGeneratedObjectSourceKey(sourceKey);
  const option = getGeneratedObjectSourceOptions(tagDefinitions).find((definition) => definition.key === normalizedSourceKey);

  return option?.label || normalizedSourceKey;
}

export function readValueAtPath(source, path) {
  if (!source || typeof source !== "object") {
    return "";
  }

  const normalizedPath = String(path || "").trim();

  if (!normalizedPath) {
    return "";
  }

  if (Object.prototype.hasOwnProperty.call(source, normalizedPath)) {
    return source[normalizedPath];
  }

  return normalizedPath.split(".").reduce((currentValue, pathSegment) => {
    if (currentValue && typeof currentValue === "object" && Object.prototype.hasOwnProperty.call(currentValue, pathSegment)) {
      return currentValue[pathSegment];
    }

    return undefined;
  }, source);
}

export function resolveGeneratedObjectPreviewValue(record, sourceKey, tagDefinitions = []) {
  const normalizedSourceKey = normalizeGeneratedObjectSourceKey(sourceKey);
  const aliases = uniqueGeneratedObjectValues([normalizedSourceKey, ...(generatedObjectSourceAliases[normalizedSourceKey] || [])]);

  for (const candidateKey of aliases) {
    const value = readValueAtPath(record, candidateKey);

    if (String(value ?? "").trim()) {
      return String(value).trim();
    }
  }

  const option = getGeneratedObjectSourceOptions(tagDefinitions).find((definition) => definition.key === normalizedSourceKey);
  const previewValue = String(option?.example || generatedObjectPreviewValues[normalizedSourceKey] || "").trim();

  return previewValue || "123100001";
}
