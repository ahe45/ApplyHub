export function getCandidateBlockTemplateSourceElement(rootElement) {
  return rootElement?.querySelector?.("[data-candidate-block-instance]") || null;
}

export function isCandidateBlockTemplateSource(blockElement) {
  if (!(blockElement instanceof HTMLElement)) {
    return false;
  }

  if (blockElement.dataset.candidateBlockTemplateRole === "source") {
    return true;
  }

  const gridElement = blockElement.closest?.("[data-candidate-block-grid], .examlist-candidate-block-grid") || null;

  return getCandidateBlockTemplateSourceElement(gridElement) === blockElement;
}

export function isCandidateBlockTemplatePreview(blockElement) {
  if (!(blockElement instanceof HTMLElement)) {
    return false;
  }

  return blockElement.dataset.candidateBlockTemplateRole === "preview" ||
    blockElement.classList.contains("is-candidate-block-template-preview");
}

export function applyCandidateBlockTemplateRoles(gridElement) {
  const blockElements = Array.from(gridElement?.querySelectorAll?.("[data-candidate-block-instance]") || []);

  blockElements.forEach((blockElement, index) => {
    const isSource = index === 0;

    blockElement.classList.toggle("is-candidate-block-template-source", isSource);
    blockElement.classList.toggle("is-candidate-block-template-preview", !isSource);
    blockElement.dataset.candidateBlockTemplateRole = isSource ? "source" : "preview";
    blockElement.setAttribute("contenteditable", "false");
    blockElement.setAttribute("aria-label", isSource ? "수험생 데이터 블록 편집 기준" : "수험생 데이터 블록 반영 미리보기");

    blockElement.setAttribute("aria-readonly", "true");
    if (!isSource) {
      blockElement.tabIndex = -1;
    }
  });

  return blockElements[0] || null;
}
