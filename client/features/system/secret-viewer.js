(function(scope) {
  let dismiss = null;
  function open({kind,opener}) {
    dismiss?.();
    if (!['email','translation'].includes(kind)) return;
    const label = kind === 'email' ? '메일 비밀번호' : '번역 API 키';
    const dialog=document.createElement('dialog');
    dialog.className='secret-value-dialog';
    dialog.setAttribute('aria-labelledby','secretValueHeading');
    dialog.innerHTML='<div class="secret-value-heading"><h3 id="secretValueHeading"></h3><button class="ghost-button" type="button" data-secret-close aria-label="닫기">닫기</button></div><form autocomplete="off"><p class="muted">현재 로그인한 계정의 비밀번호를 입력하면 저장된 값을 확인할 수 있습니다.</p><label class="field"><span>현재 비밀번호</span><input type="password" name="currentPassword" autocomplete="current-password" maxlength="4096" required /></label><p class="system-settings-status warning" role="status" aria-live="polite"></p><div class="form-actions"><button class="primary-button" type="submit">확인</button></div></form>';
    dialog.querySelector('h3').textContent=label+' 확인';
    const events=new AbortController();
    const request=new AbortController();
    let closed=false,timer=null,busy=false;
    const observer=new MutationObserver(()=>{if(opener&&!opener.isConnected)close();});
    function cleanup() {
      if(closed)return;closed=true;
      clearTimeout(timer);request.abort();events.abort();observer.disconnect();
      dialog.querySelectorAll('input,textarea').forEach(n=>{n.value='';});
      dialog.replaceChildren();dialog.remove();
      if(dismiss===close)dismiss=null;
      if(opener?.isConnected)opener.focus();
    }
    function close(){if(dialog.open)dialog.close();cleanup();}
    dismiss=close;
    dialog.querySelector('[data-secret-close]').addEventListener('click',close,{signal:events.signal});
    dialog.addEventListener('close',cleanup,{signal:events.signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)close();},{signal:events.signal});
    window.addEventListener('pagehide',close,{signal:events.signal});
    window.addEventListener('popstate',close,{signal:events.signal});
    dialog.querySelector('form').addEventListener('submit',async event=>{
      event.preventDefault();event.stopPropagation();if(busy)return;
      const form=event.currentTarget,input=form.elements.currentPassword;
      if(!form.reportValidity())return;
      const body=JSON.stringify({kind,currentPassword:input.value});input.value='';
      busy=true;input.disabled=true;
      const button=form.querySelector('[type=submit]'),status=form.querySelector('[role=status]');
      button.disabled=true;button.textContent='확인 중...';status.textContent='';
      try {
        const result=await scope.AdmitCardApiClient.apiRequest('/api/system-settings/secrets/reveal',{method:'POST',body,signal:request.signal});
        if(closed){result.value='';return;}
        if(typeof result.value!=='string')throw new Error('저장된 값을 확인하지 못했습니다.');
        form.replaceChildren();
        const field=document.createElement('label');field.className='field';
        const title=document.createElement('span');title.textContent='저장된 '+label;
        const value=document.createElement('textarea');value.readOnly=true;value.rows=3;value.spellcheck=false;value.autocomplete='off';value.setAttribute('data-secret-value','');value.value=result.value;result.value='';
        field.append(title,value);
        const note=document.createElement('p');note.className='muted';note.textContent='확인 후 닫아주세요. 1분 후 자동으로 닫힙니다.';
        form.append(field,note);value.focus();
        timer=setTimeout(close,60000);
      } catch(error) {
        if(closed)return;status.textContent=error.message;input.disabled=false;button.disabled=false;button.textContent='확인';input.focus();
      } finally {busy=false;}
    },{signal:events.signal});
    document.body.append(dialog);dialog.showModal();
    if(opener)observer.observe(document.body,{childList:true,subtree:true});
    dialog.querySelector('input').focus();
  }
  scope.AdmitCardSecretViewer={open,close:()=>dismiss?.()};
})(window);
