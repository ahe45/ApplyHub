/* Track presence only; field contents are never copied into attributes or stored. */
(() => {
  const selector='input,textarea,select';
  const excluded='[data-field-state-ignore],.paper,.template-render-sheet,.template-preview-stage,.template-editor-surface,.examlist-editor-canvas';
  const ignoredTypes=new Set(['checkbox','radio','range','color','hidden','file','button','submit','reset','image']);
  function sync(field){
    if(!(field instanceof Element)||!field.matches(selector))return;
    if(field.closest(excluded)||(field instanceof HTMLInputElement&&ignoredTypes.has(field.type))){field.removeAttribute('data-field-empty');return;}
    const filled=field instanceof HTMLSelectElement?[...field.selectedOptions].some(option=>option.value.trim()!==''):field.value.length>0;
    const value=filled?'false':'true';
    if(field.getAttribute('data-field-empty')!==value)field.setAttribute('data-field-empty',value);
  }
  function scan(root){if(root.nodeType!==1&&root.nodeType!==9)return;sync(root);root.querySelectorAll(selector).forEach(sync);}
  const pending=new Set();let scheduled=false;
  function queue(field){pending.add(field);if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;for(const node of pending)sync(node);pending.clear();});}}
  // Existing forms also assign .value without dispatching an input event.
  for(const [prototype,names] of [[HTMLInputElement.prototype,['value']],[HTMLTextAreaElement.prototype,['value']],[HTMLSelectElement.prototype,['value','selectedIndex']],[HTMLOptionElement.prototype,['selected']]]){
    for(const name of names){const descriptor=Object.getOwnPropertyDescriptor(prototype,name);if(!descriptor?.set||!descriptor.configurable)continue;
      Object.defineProperty(prototype,name,{...descriptor,set(value){descriptor.set.call(this,value);queue(this instanceof HTMLOptionElement?this.closest('select'):this);}});
    }
  }
  for(const event of ['input','change','focusin','focusout'])document.addEventListener(event,event=>sync(event.target),true);
  document.addEventListener('reset',event=>{const form=event.target;queueMicrotask(()=>scan(form));},true);
  document.addEventListener('animationstart',event=>{if(event.animationName==='field-value-autofill')queue(event.target);},true);
  new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(scan);const target=record.target.nodeType===1?record.target:record.target.parentElement;queue(target?.closest('select')||target);}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['value','selected','type','multiple'],characterData:true});
  document.addEventListener('DOMContentLoaded',()=>scan(document),{once:true});
  window.addEventListener('pageshow',()=>scan(document));
  if(document.readyState!=='loading')scan(document);
})();
