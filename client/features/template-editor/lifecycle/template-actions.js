(function (globalScope, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AdmitCardTemplateEditorLifecycleActions = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createTemplateLifecycleActionController({
    apiRequest,
    closeModal,
    createTemplateCardEditorState,
    findTemplateCard,
    getTemplateCreationSeed,
    renderView,
    showToast,
    state,
  }) {
    function updateTemplateCard(templateId, updates) {
      state.templateCards = state.templateCards.map((card) =>
        card.id === templateId
          ? {
              ...card,
              ...updates,
            }
          : card,
      );
    }

    function addTemplateCard() {
      return (async () => {
        try {
          const nextIndex = state.templateCards.length + 1;
          const templateSeed = getTemplateCreationSeed();
          const createdTemplate = await apiRequest("/api/templates", {
            method: "POST",
            body: JSON.stringify({
              name: `신규 수험표 양식 ${nextIndex}`,
              description: templateSeed.description,
              version: templateSeed.version,
              status: "unused",
              contentHtml: templateSeed.contentHtml,
            }),
          });

          state.bootstrap.error = "";
          state.templateCards = [...state.templateCards, createdTemplate];
          renderView();
        } catch (error) {
          state.bootstrap.error = error.message;
          window.alert(error.message);
          renderView();
        }
      })();
    }

    const copyingTemplateIds = new Set();

    async function copyTemplateCard(templateId) {
      const source = findTemplateCard(templateId);
      if (!source || copyingTemplateIds.has(templateId)) return;
      copyingTemplateIds.add(templateId);

      try {
        const names = new Set(state.templateCards.map(card => card.name));
        const copyName = suffix => `${source.name.slice(0, 200 - suffix.length)}${suffix}`;
        let name = copyName(" 복사");
        for (let index = 2; names.has(name); index += 1) name = copyName(` 복사 ${index}`);
        const createdTemplate = await apiRequest("/api/templates", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: source.description,
            version: source.version,
            status: "unused",
            contentHtml: source.contentHtml,
          }),
        });
        state.templateCards = [...state.templateCards, createdTemplate];
        renderView();
        showToast("양식을 복사했습니다.");
      } catch (error) {
        showToast(error.message, 4200);
      } finally {
        copyingTemplateIds.delete(templateId);
      }
    }

    function applyTemplateCard(templateId) {
      return (async () => {
        const templateCard = findTemplateCard(templateId);

        if (!templateCard) {
          return;
        }

        try {
          const templates = await apiRequest(`/api/templates/${encodeURIComponent(templateId)}/activate`, {
            method: "POST",
          });

          state.templateCards = Array.isArray(templates) ? templates : state.templateCards;
          renderView();
          const appliedTemplateName = String(templateCard.name || "").trim() || "선택한";
          showToast(`${appliedTemplateName} 양식을 사용 적용했습니다.`);
        } catch (error) {
          window.alert(error.message);
        }
      })();
    }

    function deleteTemplateCard(templateId) {
      return (async () => {
        const templateCard = findTemplateCard(templateId);

        if (!templateCard) {
          return;
        }

        if (!window.confirm(`"${templateCard.name}" 양식을 삭제하시겠습니까?`)) {
          return;
        }

        try {
          await apiRequest(`/api/templates/${encodeURIComponent(templateId)}`, {
            method: "DELETE",
          });

          state.templateCards = state.templateCards.filter((card) => card.id !== templateId);
          if (state.templateCardEditor.activeTemplateId === templateId) {
            state.templateCardEditor = createTemplateCardEditorState();
          }

          if (state.templateEditor.activeTemplateId === templateId) {
            closeModal("templateEditorModal");
          }

          if (state.templatePreview.activeTemplateId === templateId) {
            closeModal("templatePreviewModal");
          }

          renderView();
        } catch (error) {
          window.alert(error.message);
        }
      })();
    }

    return Object.freeze({
      addTemplateCard,
      applyTemplateCard,
      copyTemplateCard,
      deleteTemplateCard,
      updateTemplateCard,
    });
  }

  return Object.freeze({
    createTemplateLifecycleActionController,
  });
});
