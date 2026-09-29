// piclea opens these pages in a tab named "piclea-info" so the work in progress stays put.
// From that tab, links back to piclea close the tab instead of starting a second copy of the app.
(()=>{
  if(window.name!=='piclea-info')return;
  const home=new URL('./',document.currentScript.src).href;
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[href]');
    if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const u=new URL(a.href);
    if(u.origin+u.pathname!==home&&u.origin+u.pathname!==home+'index.html')return;
    e.preventDefault();
    window.close();
    // Not closable (e.g. the home-screen app's in-app browser): go there in this tab, and drop the name so piclea's own links don't target itself
    setTimeout(()=>{window.name='';location.href=a.href},250);
  });
})();
