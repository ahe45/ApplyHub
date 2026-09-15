(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardExamineeFields = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const createFieldDefinition = ({
    key,
    label,
    gridLabel = label,
    exportWidth = 16,
  }) =>
    Object.freeze({
      key,
      label,
      gridLabel,
      exportWidth,
    });

  const examineeFieldDefinitions = Object.freeze([
    createFieldDefinition({
      key: "track",
      label: "모집시기",
      exportWidth: 14,
    }),
    createFieldDefinition({
      key: "admission",
      label: "전형",
      exportWidth: 18,
    }),
    createFieldDefinition({
      key: "series",
      label: "계열",
      exportWidth: 16,
    }),
    createFieldDefinition({
      key: "unit",
      label: "모집단위",
      exportWidth: 18,
    }),
    createFieldDefinition({
      key: "major",
      label: "전공",
      exportWidth: 16,
    }),
    createFieldDefinition({
      key: "examineeNo",
      label: "수험번호",
      exportWidth: 16,
    }),
    createFieldDefinition({
      key: "name",
      label: "이름",
      exportWidth: 14,
    }),
    createFieldDefinition({
      key: "birth",
      label: "생년월일",
      exportWidth: 14,
    }),
  ]);

  const examineeFieldDefinitionMap = Object.freeze(
    examineeFieldDefinitions.reduce((definitionsByKey, definition) => {
      definitionsByKey[definition.key] = definition;
      return definitionsByKey;
    }, {}),
  );

  const examineeGridFieldKeys = Object.freeze([
    "track",
    "admission",
    "series",
    "unit",
    "major",
    "examineeNo",
    "name",
    "birth",
  ]);

  const headerFilterFieldKeys = Object.freeze(["track", "admission", "series"]);
  const lookupSelectFieldKeys = Object.freeze(["track", "admission", "series", "unit", "major"]);

  const getFieldDefinition = (key) => examineeFieldDefinitionMap[String(key || "").trim()] || null;

  const createGridColumns = ({ keys = examineeGridFieldKeys } = {}) =>
    Object.freeze(
      keys
        .map((key) => getFieldDefinition(key))
        .filter(Boolean)
        .map((definition) =>
          Object.freeze({
            key: definition.key,
            label: definition.gridLabel,
            sortable: true,
            filterable: true,
          }),
        ),
    );

  const createWorkbookTextColumns = ({ keys = examineeGridFieldKeys } = {}) =>
    Object.freeze(
      keys
        .map((key) => getFieldDefinition(key))
        .filter(Boolean)
        .map((definition) =>
          Object.freeze({
            header: definition.label,
            key: definition.key,
            width: definition.exportWidth,
            text: true,
          }),
        ),
    );

  return {
    createGridColumns,
    createWorkbookTextColumns,
    examineeFieldDefinitions,
    examineeGridFieldKeys,
    getFieldDefinition,
    headerFilterFieldKeys,
    lookupSelectFieldKeys,
  };
});
