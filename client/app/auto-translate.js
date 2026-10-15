(() => {
  function bindings(editor) {
    const rows = [];
    const add = (source, targets) => { if (source && Object.values(targets).some(Boolean)) rows.push({source,targets}); };
    for (const attr of ['data-applicant-field-input','data-signup-field-input','data-term-input','data-applicant-recruitment-input']) {
      editor.querySelectorAll(`[data-edit-language="ko"] [${attr}]`).forEach(source => {
        const key = source.getAttribute(attr);
        const suffix = key.startsWith('optionKorean:') ? {en:key.replace('optionKorean:', 'optionEnglish:'), mn:key.replace('optionKorean:', 'optionMongolian:')} : {en:key+'En',mn:key+'Mn'};
        add(source, Object.fromEntries(Object.entries(suffix).map(([code,name])=>[code,editor.querySelector(`[${attr}="${name}"]`)])));
      });
    }
    return rows;
  }
  const read = node => node.isContentEditable ? node.innerHTML : node.value;
  const write = (node,value) => { node.value=value; node.dispatchEvent(new Event('input',{bubbles:true})); };
  function mount(menu) {
    if (!menu.getAttribute('editor-key')) return;
    menu.classList.add('has-auto-translation');
    const controls=document.createElement('div');controls.className='auto-translation-controls';
    controls.innerHTML='<button type="button" class="ghost-button auto-translate-button">자동 번역</button><label class="auto-translation-overwrite"><input type="checkbox">기존 번역 교체</label><span class="auto-translation-status" role="status" aria-live="polite"></span>';
    menu.append(controls);
    const button=controls.querySelector('button'), overwrite=controls.querySelector('input'), status=controls.querySelector('[role=status]');
    menu.translationSync=()=>{
      if(menu.translationBusy)return;
      const editor=menu.closest('[data-language-editor]');
      button.disabled=menu.hasAttribute('disabled')||!!menu.closest('fieldset:disabled')||!editor||(!editor.querySelector('[data-notice-editor-language=ko]')&&!bindings(editor).some(row=>!row.source.disabled));
    };
    queueMicrotask(menu.translationSync);
    button.addEventListener('click',async()=>{
      if(menu.hasAttribute('disabled') || menu.closest('fieldset:disabled'))return;
      const editor=menu.closest('[data-language-editor]'); if(!editor)return;
      const locales=menu.value==='ko'?ApplyHubLanguages.definitions.filter(l=>l.code!=='ko').map(l=>l.code):[menu.value];
      const rows=bindings(editor);const entries=[],updates=[];
      for(const row of rows) {
        const sourceValue=read(row.source);if(!sourceValue?.trim()||row.source.disabled)continue;
        const targets=locales.filter(code=>row.targets[code]&&!row.targets[code].disabled&&(overwrite.checked||!read(row.targets[code]).trim()));
        if(!targets.length)continue;
        const id='f'+entries.length;entries.push({id,text:sourceValue});
        targets.forEach(code=>updates.push({id,code,node:row.targets[code],before:read(row.targets[code]),source:row.source,sourceValue}));
      }
      const sourceNotice=editor.querySelector('[data-notice-editor-language=ko]');
      if(sourceNotice?.textContent.trim()) {
        const walker=document.createTreeWalker(sourceNotice,NodeFilter.SHOW_TEXT);
        const sourceNodes=[];while(walker.nextNode())if(walker.currentNode.nodeValue.trim()&&!walker.currentNode.parentElement.closest('style,script'))sourceNodes.push(walker.currentNode);
        const snapshot=sourceNotice.innerHTML;
        let sourceIds;
        for(const code of locales) {
          const target=editor.querySelector(`[data-notice-editor-language=${code}]`);
          if(!target || (!overwrite.checked&&target.textContent.trim()))continue;
          const clone=sourceNotice.cloneNode(true),targetWalker=document.createTreeWalker(clone,NodeFilter.SHOW_TEXT),cloneNodes=[];
          while(targetWalker.nextNode())if(targetWalker.currentNode.nodeValue.trim()&&!targetWalker.currentNode.parentElement.closest('style,script'))cloneNodes.push(targetWalker.currentNode);
          if(!sourceIds)sourceIds=sourceNodes.map(node=>{const id='f'+entries.length;entries.push({id,text:node.nodeValue});return id;});
          const noticeIds=sourceIds.map((id,i)=>({id,node:cloneNodes[i]}));
          updates.push({code,node:target,before:target.innerHTML,source:sourceNotice,sourceValue:snapshot,noticeIds,clone});
        }
      }
      if(!entries.length){status.textContent='한국어 내용을 입력하세요. 기존 번역을 바꾸려면 교체를 선택하세요.';return;}
      const controller=new AbortController();menu.translationAbort?.abort();menu.translationAbort=controller;
      menu.translationBusy=true;
      button.disabled=true;overwrite.disabled=true;status.textContent='번역 중…';
      try {
        const result=await AdmitCardApiClient.apiRequest('/api/admin/translations',{method:'POST',body:JSON.stringify({entries,languages:locales}),signal:controller.signal});
        if(!menu.isConnected||controller.signal.aborted)return;
        const applicable=updates.filter(u=>u.node.isConnected&&read(u.node)===u.before&&read(u.source)===u.sourceValue);
        // Validate every value before writing any field; failed output stays a draft.
        for(const u of applicable){const values=u.noticeIds?u.noticeIds.map(n=>result.translations?.[u.code]?.[n.id]):[result.translations?.[u.code]?.[u.id]];if(values.some(v=>typeof v!=='string'))throw Error('번역 결과를 확인할 수 없습니다.');if(!u.noticeIds&&u.node.maxLength>0&&values[0].length>u.node.maxLength)throw Error('번역문이 입력란의 최대 길이를 초과했습니다. 내용을 줄여 다시 시도하세요.');}
        for(const u of applicable){if(u.noticeIds){u.noticeIds.forEach(n=>n.node.nodeValue=result.translations[u.code][n.id]);u.node.innerHTML=u.clone.innerHTML;u.node.dispatchEvent(new CustomEvent('applyhub:notice-translation',{bubbles:true,detail:{language:u.code}}));}else write(u.node,result.translations[u.code][u.id]);}
        status.textContent=applicable.length?`번역을 입력했습니다. 내용을 확인한 뒤 저장하세요.${applicable.length<updates.length?' 편집 중 변경된 항목은 유지했습니다.':''}`:'입력 내용이 변경되어 번역을 적용하지 않았습니다. 다시 시도하세요.';
      }catch(error){if(!controller.signal.aborted)status.textContent=error.message||'번역하지 못했습니다. 다시 시도하세요.';}
      finally{menu.translationBusy=false;if(menu.isConnected){menu.translationSync();overwrite.disabled=false;}}
    },{signal:menu.abort.signal});
  }
  globalThis.ApplyHubAutoTranslation={mount};
})();
