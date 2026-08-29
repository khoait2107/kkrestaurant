(function(){
  'use strict';

  let dragItem = null;
  let refreshTimer = null;

  function qs(s, root=document){ return root.querySelector(s); }
  function qsa(s, root=document){ return [...root.querySelectorAll(s)]; }

  window.adminToast = function(message, type='success', title='Thành công'){
    if(typeof window.showToast === 'function') return window.showToast(message,type,title);
    console[type==='error'?'error':'log'](title + ': ' + message);
  };

  async function parseResponse(response){
    const ct = response.headers.get('content-type') || '';
    if(ct.includes('application/json')) return response.json();
    return {ok: response.ok, html: await response.text()};
  }

  async function ajaxRequest(url, options={}){
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content ||
      document.querySelector('#adminSecurityForm input[name="_csrf"]')?.value ||
      document.querySelector('#adminCsrfToken')?.value ||
      document.querySelector('input[name="_csrf"]')?.value || '';

    const headers = Object.assign({}, options.headers||{}, {
      'X-Requested-With':'XMLHttpRequest',
      'Accept':'application/json',
      'X-CSRF-Token':csrf
    });

    // Also send CSRF in JSON bodies. The server accepts this as a fallback
    // for proxies/environments that strip custom headers.
    let requestBody = options.body;
    const contentType = String(headers['Content-Type'] || headers['content-type'] || '');
    if (csrf && typeof requestBody === 'string' && contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(requestBody);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !parsed._csrf) {
          parsed._csrf = csrf;
          requestBody = JSON.stringify(parsed);
        }
      } catch (_) {}
    }

    const res = await fetch(url, Object.assign({}, options, {credentials:'same-origin', headers, body:requestBody}));
    if(res.status===401){
      window.location.href='/admin';
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    const data = await parseResponse(res);
    if(!res.ok || data.ok === false){
      const err = new Error(data.message || 'Không thể hoàn thành thao tác.');
      err.data = data; throw err;
    }
    return data;
  }

  function setBusy(form, busy){
    if(!form) return;
    form.classList.toggle('is-submitting', busy);
    qsa('button, input, select, textarea', form).forEach(el=>{
      if(busy){ el.dataset.wasDisabled = el.disabled ? '1':'0'; el.disabled = true; }
      else { el.disabled = el.dataset.wasDisabled === '1'; delete el.dataset.wasDisabled; }
    });
  }

  async function refreshAdmin(opts={}){
    const root = qs('#adminRoot');
    if(!root) return;
    if(refreshTimer) clearTimeout(refreshTimer);
    const hash = opts.hash || window.location.hash || '#orders';
    const scrollY = window.scrollY;
    root.classList.add('admin-refreshing');
    try{
      const res = await fetch('/admin?partial=1', {credentials:'same-origin', headers:{'X-Requested-With':'XMLHttpRequest','Accept':'text/html'}});
      if(res.status===401 || res.redirected){ window.location.href='/admin'; return; }
      if(!res.ok) throw new Error('Không thể tải lại dữ liệu Admin.');
      const html = await res.text();
      const tmp = document.createElement('template');
      tmp.innerHTML = html.trim();
      const next = tmp.content.querySelector('#adminContent');
      if(!next){ window.location.href='/admin'; return; }
      root.innerHTML = next.innerHTML;
      root.classList.remove('admin-refreshing');
      bindAdmin();
      if(hash) window.history.replaceState(null,'',hash);
      requestAnimationFrame(()=>window.scrollTo({top:scrollY,behavior:'auto'}));
    }catch(err){
      root.classList.remove('admin-refreshing');
      adminToast(err.message,'error','Không thể cập nhật');
    }
  }
  window.refreshAdmin = refreshAdmin;

  function setupLogoPreview(){
    const input=qs('#logoImageFile'), preview=qs('#logoPreview .logo-preview-inner');
    if(!input || !preview) return;
    input.onchange=()=>{
      const file=input.files && input.files[0];
      if(!file) return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
        adminToast('Vui lòng chọn ảnh JPG, PNG hoặc WEBP.','warning','Ảnh logo chưa hợp lệ');
        input.value=''; return;
      }
      const url=URL.createObjectURL(file);
      preview.innerHTML='<img src="'+url+'" alt="Logo xem trước">';
      const img=preview.querySelector('img');
      if(img) img.onload=()=>URL.revokeObjectURL(url);
    };
  }

  function setupHeroBannerPreview(){
    const input=qs('#heroImageFile'), preview=qs('#heroBannerPreview img');
    if(!input || !preview) return;
    input.onchange=()=>{
      const file=input.files && input.files[0];
      if(!file) return;
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
        adminToast('Vui lòng chọn ảnh JPG, PNG hoặc WEBP.','warning','Ảnh banner chưa hợp lệ');
        input.value=''; return;
      }
      const url=URL.createObjectURL(file);
      preview.src=url;
      preview.onload=()=>URL.revokeObjectURL(url);
    };
  }

  function setupLocationImagePreviews(){
    ['location_main_image','location_side_image_1','location_side_image_2'].forEach(key=>{
      const input=qs('#'+key+'_file'), preview=qs('#'+key+'_preview img');
      if(!input || !preview) return;
      input.onchange=()=>{
        const file=input.files && input.files[0];
        if(!file) return;
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
          adminToast('Vui lòng chọn ảnh JPG, PNG hoặc WEBP.','warning','Ảnh Địa điểm chưa hợp lệ');
          input.value=''; return;
        }
        const url=URL.createObjectURL(file);
        preview.src=url;
        preview.onload=()=>URL.revokeObjectURL(url);
      };
    });
  }

  async function submitAjaxForm(form){
    if(form.dataset.ajax === 'false') return;
    const action = form.action || window.location.href;
    const method = (form.method || 'POST').toUpperCase();
    const isDelete = form.dataset.confirm;
    if(isDelete){
      const ok = await window.showConfirm(isDelete, form.dataset.confirmTitle || 'Xác nhận thao tác');
      if(!ok) return;
    }
    if(typeof window.validateVoucherDates === 'function' && form.action.endsWith('/admin/voucher') && !window.validateVoucherDates()) return;

    // FormData MUST be built before disabling fields. Disabled inputs are
    // excluded from FormData, which previously caused settings/menu/category
    // values (and checkbox states) to be saved as empty/false.
    const body = new FormData(form);
    // Always include the CSRF token in the form body as a fallback.
    // This makes multipart/form-data submissions robust even when a cached
    // page/template is missing the meta token or a custom header is stripped.
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ||
      document.querySelector('#adminSecurityForm input[name="_csrf"]')?.value ||
      document.querySelector('input[name="_csrf"]')?.value || '';
    if (csrfToken && !body.has('_csrf')) body.append('_csrf', csrfToken);
    setBusy(form,true);
    try{
      await ajaxRequest(action,{method,body,headers:{'X-Requested-With':'XMLHttpRequest','Accept':'application/json'}});
      if(form.id==='dishForm') window.closeDish?.();
      if(form.closest('#voucherModal')) window.closeVoucher?.();
      adminToast('Đã lưu thay đổi.','success','Cập nhật thành công');
      await refreshAdmin({hash:form.dataset.refreshHash || window.location.hash || '#orders'});
    }catch(err){
      adminToast(err.message,'error','Thao tác thất bại');
    }finally{ setBusy(form,false); }
  }

  async function updateStatus(url, st, select){
    const previous = select ? (select.dataset.currentStatus || select.value) : '';
    if(select) { select.disabled=true; }
    try{
      await ajaxRequest(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:st})});
      if(select) select.dataset.currentStatus=st;
      adminToast('Trạng thái đã được cập nhật.','success','Đã cập nhật');
    }catch(err){
      if(select && previous) { select.value=previous; select.dataset.currentStatus=previous; }
      adminToast(err.message,'error','Không thể cập nhật');
    }finally{ if(select) select.disabled=false; }
  }
  window.updateStatus = updateStatus;

  window.openAddDish = function(){
    const form=qs('#dishForm'); if(!form) return;
    qs('#modalTitle').textContent='Thêm món mới'; form.action='/admin/menu/add';
    qs('#dishId').value=''; qs('#oldImage').value=''; qs('#dishName').value='';
    qs('#dishCategory').selectedIndex=0; qs('#dishPrice').value=''; qs('#dishBadge').value=''; qs('#dishDesc').value='';
    qs('#dishActive').checked=true; qs('#dishFeatured').checked=false; qs('#dishSortOrder').value='9999'; qs('#currentImage').innerHTML='';
    qs('#dishModal').classList.add('show'); setTimeout(()=>qs('#dishName')?.focus(),50);
  };
  window.editDish = function(x){
    qs('#modalTitle').textContent='Sửa món'; qs('#dishForm').action='/admin/menu/save';
    qs('#dishId').value=x.id; qs('#oldImage').value=x.image; qs('#dishName').value=x.name; qs('#dishCategory').value=x.category;
    qs('#dishPrice').value=(Number(x.price||0)/100).toFixed(2); qs('#dishBadge').value=x.badge||''; qs('#dishDesc').value=x.description||'';
    qs('#dishActive').checked=!!x.active; qs('#dishFeatured').checked=!!x.featured; qs('#dishSortOrder').value=x.sort_order||0;
    qs('#currentImage').innerHTML='<img src="'+String(x.image).replace(/"/g,'&quot;')+'" alt="Ảnh hiện tại">'; qs('#dishModal').classList.add('show');
    setTimeout(()=>qs('#dishName')?.focus(),50);
  };
  window.closeDish = function(){ qs('#dishModal')?.classList.remove('show'); };

  window.toggleDishCategory = function(btn){
    const group=btn.closest('.dish-category-group'), body=group.querySelector('.category-dish-grid');
    const open=btn.getAttribute('aria-expanded')==='true'; btn.setAttribute('aria-expanded',String(!open)); body.hidden=open; group.classList.toggle('open',!open);
  };
  window.setDishCategoryOpen = function(group,open){ const btn=group.querySelector('.category-badge'),body=group.querySelector('.category-dish-grid'); btn.setAttribute('aria-expanded',String(open)); body.hidden=!open; group.classList.toggle('open',open); };
  window.toggleAllCategories = function(){ const groups=qsa('.dish-category-group'); const shouldOpen=groups.some(g=>g.querySelector('.category-dish-grid').hidden); groups.forEach(g=>setDishCategoryOpen(g,shouldOpen)); };
  function filterDishes(){
    const search=qs('#dishSearch'), cat=qs('#dishCat'); if(!search||!cat)return;
    const q=search.value.toLowerCase().trim(), c=cat.value;
    qsa('.dish-category-group').forEach(group=>{
      const catMatch=c==='all'||group.dataset.category===c; let visible=0;
      qsa('.dish-admin-card',group).forEach(x=>{ const show=catMatch && x.dataset.name.includes(q); x.style.display=show?'':'none'; if(show)visible++; });
      group.style.display=visible?'':'none'; if(visible && (q||c!=='all')) setDishCategoryOpen(group,true);
    });
  }

  window.toggleFeatured = function(cb){
    const item=cb.closest('.featured-sort-item');
    if(cb.checked){
      const count=qsa('#featuredSortList .featured-check input:checked').length;
      if(count>8){
        cb.checked=false;
        adminToast('Chỉ được chọn tối đa 8 món nổi bật trên trang chủ.','warning','Đã đạt giới hạn');
        return;
      }
    }
    item?.classList.toggle('is-featured',cb.checked);
    updateFeaturedCount();
  };
  window.updateFeaturedCount = function(){ const n=qsa('#featuredSortList .featured-check input:checked').length; const el=qs('#featuredCount'); if(el)el.textContent=n; };
  window.saveMenuOrder = async function(){
    const list=qsa('#featuredSortList .featured-sort-item'); const ids=list.map(x=>x.dataset.id);
    const featured=Object.fromEntries(list.map(x=>[x.dataset.id,x.querySelector('input').checked]));
    const state=qs('#orderSaveState'); if(state)state.textContent='Đang lưu…';
    try{
      await ajaxRequest('/admin/menu/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,featured})});
      if(state)state.textContent='✓ Đã lưu thứ tự và món nổi bật'; adminToast('Đã lưu thứ tự và danh sách món nổi bật.','success','Lưu thành công');
      await refreshAdmin({hash:'#featured'});
    }catch(err){ if(state)state.textContent='Không thể lưu, vui lòng thử lại.'; adminToast(err.message,'error','Không thể lưu'); }
  };

  window.openVoucher = function(v){
    qs('#voucherModalTitle').textContent=v?'Sửa voucher':'Thêm voucher'; qs('#voucherOldCode').value=v?.code||''; qs('#voucherCode').value=v?.code||'';
    const voucherType=v?.type||'percent'; qs('#voucherType').value=voucherType; qs('#voucherValue').value=voucherType==='fixed'?(Number(v?.value)||0)/100:(v?.value??''); qs('#voucherMinOrder').value=((Number(v?.min_order)||0)/100).toFixed(2);
    qs('#voucherStart').value=v?.start_date||''; qs('#voucherEnd').value=v?.end_date||''; qs('#voucherModal').classList.add('show'); setTimeout(()=>qs('#voucherCode')?.focus(),50);
  };
  window.editVoucher = function(v){ openVoucher(v); };
  window.closeVoucher = function(){ qs('#voucherModal')?.classList.remove('show'); };
  window.validateVoucherDates = function(){ const a=qs('#voucherStart')?.value,b=qs('#voucherEnd')?.value; if(a&&b&&a>b){adminToast('Ngày kết thúc phải từ ngày áp dụng trở đi.','warning','Ngày voucher chưa hợp lệ');return false;}return true; };

  window.deleteCat = async function(id, used){
    if(used>0){ adminToast('Danh mục đang có '+used+' món. Hãy chuyển hoặc xóa các món trước khi xóa.','warning','Không thể xóa danh mục'); return false; }
    const ok=await window.showConfirm('Xóa danh mục này? Thao tác này không thể hoàn tác.','Xác nhận xóa danh mục');
    if(!ok)return false;
    try{ await ajaxRequest('/admin/category/delete/'+encodeURIComponent(id),{method:'POST'}); adminToast('Đã xóa danh mục.','success','Xóa thành công'); await refreshAdmin({hash:'#categories'}); }
    catch(err){ adminToast(err.message,'error','Không thể xóa'); }
    return false;
  };

  function setAdminNavActive(hash){
    const links=qsa('[data-admin-nav]');
    const target=hash || '#overview';
    links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===target));
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function formatAuditDetails(raw){
    if(!raw) return '';
    try{
      const obj=typeof raw==='string' ? JSON.parse(raw) : raw;
      if(!obj || typeof obj!=='object') return escapeHtml(raw);
      return Object.entries(obj).map(([k,v])=>{
        const text=(v && typeof v==='object') ? JSON.stringify(v) : String(v ?? '');
        return '<b>'+escapeHtml(k)+'</b>: '+escapeHtml(text);
      }).join('<br>');
    }catch(_){ return escapeHtml(raw); }
  }

  function auditActionLabel(action){
    const labels={
      LOGIN_SUCCESS:'Đăng nhập',
      CHANGE_CREDENTIALS:'Đổi thông tin Admin',
      REVOKE_SESSIONS:'Thu hồi phiên',
      CREATE:'Tạo mới',
      UPDATE:'Cập nhật',
      DELETE:'Xóa',
      FEATURED:'Món nổi bật',
      REORDER_FEATURED:'Sắp xếp món nổi bật',
      UPDATE_STATUS:'Cập nhật trạng thái',
      TOGGLE:'Ẩn/hiện',
      MOVE:'Di chuyển',
      UPSERT:'Cập nhật voucher',
      IMPORT:'Import Excel'
    };
    return labels[action] || action || '—';
  }

  function auditEntityLabel(type){
    const labels={menu_item:'Món ăn',category:'Danh mục',voucher:'Voucher',
      order:'Đơn hàng',booking:'Đặt bàn',settings:'Cài đặt',admin:'Tài khoản Admin'};
    return labels[type] || type || '—';
  }

  async function loadAuditLog(){
    const health=qs('#auditHealth');
    const tbody=qs('#auditLogTable tbody');
    if(!tbody) return;

    if(health) health.textContent='Đang tải nhật ký…';
    tbody.innerHTML='<tr><td colspan="5" class="muted">Đang tải…</td></tr>';

    try{
      const [healthRes, logData] = await Promise.all([
        fetch('/admin/health',{credentials:'same-origin',headers:{'X-Requested-With':'XMLHttpRequest','Accept':'application/json'}}),
        ajaxRequest('/admin/audit-logs?limit=100',{method:'GET'})
      ]);

      if(!healthRes.ok) throw new Error('Không thể kiểm tra trạng thái hệ thống.');
      const healthData=await healthRes.json();

      if(logData.logs?.length){
        tbody.innerHTML=logData.logs.map(row=>{
          const detail=formatAuditDetails(row.details);
          const time=escapeHtml(row.created_at || '');
          const admin=escapeHtml(row.username || 'system');
          const action=escapeHtml(auditActionLabel(row.action));
          const entity=escapeHtml(auditEntityLabel(row.entity_type)) +
            (row.entity_id ? '<small class="muted"> #'+escapeHtml(row.entity_id)+'</small>' : '');
          return '<tr><td>'+time+'</td><td>'+admin+'</td><td>'+action+'</td><td>'+entity+'</td><td>'+detail+'</td></tr>';
        }).join('');
      }else{
        tbody.innerHTML='<tr><td colspan="5" class="muted">Chưa có nhật ký quản trị.</td></tr>';
      }

      if(health){
        const c=healthData.checks||{};
        const coreOk=healthData.ok;
        health.textContent=(coreOk ? '✓ Hệ thống hoạt động bình thường' : '⚠ Có mục cần kiểm tra')+
          ' · Database '+(c.database_connection?'OK':'LỖI')+
          ' · SQLite '+(c.sqlite_integrity?'OK':'LỖI')+
          ' · WAL '+(c.journal_mode?'OK':'LỖI')+
          ' · Backup '+(c.backup_available?'OK':'CẦN KIỂM TRA');
        health.classList.toggle('health-ok',!!coreOk);
        health.classList.toggle('health-warn',!coreOk);
      }
    }catch(err){
      if(health) health.textContent='Không thể tải nhật ký.';
      tbody.innerHTML='<tr><td colspan="5" class="muted">Lỗi: '+escapeHtml(err.message)+'</td></tr>';
      if(err.message.includes('Phiên đăng nhập')) return;
      adminToast(err.message,'error','Nhật ký quản trị');
    }
  }
  window.loadAuditLog=loadAuditLog;

  function showAdminSection(hash, focus=true){
    const target=hash || '#overview';
    const sections=qsa('.admin-main > .admin-section, .admin-main > #overview');
    let matched=false;
    sections.forEach(section=>{
      const active=('#'+section.id)===target;
      section.classList.toggle('is-admin-active',active);
      section.hidden=!active;
      if(active) matched=true;
    });
    const finalTarget=matched ? target : '#overview';
    if(!matched){
      const overview=qs('#overview');
      if(overview){ overview.hidden=false; overview.classList.add('is-admin-active'); }
      setAdminNavActive('#overview');
    } else {
      setAdminNavActive(finalTarget);
    }
    if(focus && finalTarget !== '#overview') {
      requestAnimationFrame(()=>qs(finalTarget)?.focus?.({preventScroll:true}));
    }
    if(finalTarget === '#audit' && typeof loadAuditLog === 'function') loadAuditLog();
    return finalTarget;
  }
  window.showAdminSection=showAdminSection;

  function closeAdminSidebar(){
    const sidebar=qs('#adminSidebar'), overlay=qs('#adminSidebarOverlay');
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('show');
    document.body.classList.remove('admin-menu-open');
  }

  function openAdminSidebar(){
    const sidebar=qs('#adminSidebar'), overlay=qs('#adminSidebarOverlay');
    sidebar?.classList.add('mobile-open');
    overlay?.classList.add('show');
    document.body.classList.add('admin-menu-open');
  }

  function setupAdminSidebar(){
    const links=qsa('[data-admin-nav]');
    if(!links.length) return;
    const current=window.location.hash && qs(window.location.hash) ? window.location.hash : '#overview';
    showAdminSection(current,false);
    links.forEach(link=>{
      link.onclick=(event)=>{
        event.preventDefault();
        const target=link.getAttribute('href');
        showAdminSection(target,true);
        window.history.replaceState(null,'',target);
        closeAdminSidebar();
      };
    });
    qs('.admin-menu-toggle')?.addEventListener('click',openAdminSidebar);
    qs('.admin-sidebar-close')?.addEventListener('click',closeAdminSidebar);
    qs('#adminSidebarOverlay')?.addEventListener('click',closeAdminSidebar);
  }
  window.setupAdminSidebar=setupAdminSidebar;

  function bindSecurityControls(){
    qsa('[data-password-toggle]').forEach(btn=>{
      if(btn.dataset.bound) return;
      btn.dataset.bound='1';
      btn.addEventListener('click',()=>{
        const input=qs('#'+btn.dataset.passwordToggle);
        if(input) input.type=input.type==='password'?'text':'password';
      });
    });
    const logoutOthers=qs('#logoutOtherAdminSessions');
    if(logoutOthers && !logoutOthers.dataset.bound){
      logoutOthers.dataset.bound='1';
      logoutOthers.addEventListener('click',async()=>{
        const token=qs('#adminSecurityForm input[name="_csrf"]')?.value || '';
        try{
          await ajaxRequest('/admin/security/logout-other-sessions',{
            method:'POST',
            headers:{'X-CSRF-Token':token}
          });
          adminToast('Đã vô hiệu hóa các phiên Admin khác.','success','Bảo mật');
        }catch(err){ adminToast(err.message,'error','Bảo mật'); }
      });
    }
  }


  let menuImportToken='';

  window.openMenuImport=function(){
    const modal=qs('#menuImportModal');
    if(!modal) return;
    const form=qs('#menuImportForm');
    if(form) form.reset();
    const result=qs('#menuImportResult'); if(result){result.hidden=true;result.innerHTML='';}
    const preview=qs('#menuImportPreview'); if(preview){preview.hidden=true;preview.innerHTML='';}
    const commit=qs('#menuImportCommitBtn'); if(commit) commit.hidden=true;
    const check=qs('#menuImportCheckBtn'); if(check){check.hidden=false;check.disabled=false;check.textContent='Kiểm tra file';}
    menuImportToken='';
    modal.classList.add('show');
  };

  window.closeMenuImport=function(){ qs('#menuImportModal')?.classList.remove('show'); };

  function renderImportResult(data){
    const result=qs('#menuImportResult');
    if(!result) return;
    const errors=data.errors||[], warnings=data.warnings||[];
    result.hidden=false;
    let html='<div class="import-summary">'+
      '<span class="import-pill">Tổng: '+escapeHtml(data.total??0)+'</span>'+
      '<span class="import-pill ok">Hợp lệ: '+escapeHtml(data.valid??0)+'</span>'+
      '<span class="import-pill '+(errors.length?'bad':'ok')+'">Lỗi: '+errors.length+'</span>'+
      '<span class="import-pill '+(warnings.length?'warn':'ok')+'">Cảnh báo: '+warnings.length+'</span></div>';
    if(errors.length){
      html+='<ul class="import-error-list">'+errors.slice(0,50).map(e=>'<li>Dòng '+escapeHtml(e.row)+': '+escapeHtml(e.message)+'</li>').join('')+'</ul>';
    }
    if(warnings.length){
      html+='<ul class="import-warning-list">'+warnings.slice(0,50).map(e=>'<li>Dòng '+escapeHtml(e.row)+': '+escapeHtml(e.message)+'</li>').join('')+'</ul>';
    }
    result.innerHTML=html;
  }

  function renderImportPreview(rows){
    const box=qs('#menuImportPreview');
    if(!box) return;
    if(!rows?.length){box.hidden=true;box.innerHTML='';return;}
    box.hidden=false;
    box.innerHTML='<table><thead><tr><th>Dòng</th><th>Thao tác</th><th>Danh mục</th><th>Món</th><th>Giá</th><th>Available</th><th>Featured</th><th>Image</th></tr></thead><tbody>'+rows.map(r=>
      '<tr><td>'+escapeHtml(r.row)+'</td><td class="'+(r.action==='update'?'import-action-update':'import-action-create')+'">'+(r.action==='update'?'Cập nhật':'Tạo mới')+'</td><td>'+escapeHtml(r.category)+'</td><td><b>'+escapeHtml(r.name)+'</b></td><td>'+escapeHtml(moneyDisplay(r.price))+'</td><td>'+ (r.active?'Yes':'No') +'</td><td>'+ (r.featured?'Yes':'No') +'</td><td>'+escapeHtml(r.image||'—')+'</td></tr>'
    ).join('')+'</tbody></table>';
  }

  function moneyDisplay(cents){
    const n=Number(cents||0); return '$'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  async function previewMenuImport(event){
    event.preventDefault();
    const form=event.target;
    const file=qs('#menuImportFile')?.files?.[0];
    if(!file){adminToast('Vui lòng chọn file .xlsx.','error','Import Menu');return;}
    if(!file.name.toLowerCase().endsWith('.xlsx')){adminToast('Chỉ hỗ trợ file Excel .xlsx.','error','Import Menu');return;}
    const btn=qs('#menuImportCheckBtn');
    if(btn){btn.disabled=true;btn.textContent='Đang kiểm tra…';}
    try{
      const fd=new FormData(); fd.append('excel_file',file);
      const data=await ajaxRequest('/admin/menu/import/preview',{method:'POST',body:fd,headers:{}});
      menuImportToken=data.token||'';
      renderImportResult(data); renderImportPreview(data.rows||[]);
      const commit=qs('#menuImportCommitBtn'); if(commit) commit.hidden=!(menuImportToken && !(data.errors||[]).length && (data.valid||0)>0);
      if(btn){btn.textContent='Kiểm tra lại file';btn.disabled=false;}
      if((data.errors||[]).length) adminToast('File còn lỗi, hãy sửa Excel rồi kiểm tra lại.','error','Import Menu');
      else adminToast('File hợp lệ. Bạn có thể xác nhận Import.','success','Import Menu');
    }catch(err){
      menuImportToken='';
      renderImportResult({total:0,valid:0,errors:[{row:'—',message:err.message}],warnings:[]});
      qs('#menuImportPreview')?.setAttribute('hidden','hidden');
      const commit=qs('#menuImportCommitBtn'); if(commit) commit.hidden=true;
      if(btn){btn.textContent='Kiểm tra file';btn.disabled=false;}
      adminToast(err.message,'error','Import Menu');
    }
  }

  async function commitMenuImport(){
    if(!menuImportToken){adminToast('Chưa có file hợp lệ để Import.','error','Import Menu');return;}
    const btn=qs('#menuImportCommitBtn'); if(btn){btn.disabled=true;btn.textContent='Đang Import…';}
    try{
      const fd=new FormData(); fd.append('token',menuImportToken);
      const data=await ajaxRequest('/admin/menu/import/commit',{method:'POST',body:fd,headers:{}});
      closeMenuImport();
      adminToast(data.message+' Tạo mới: '+data.created+' · Cập nhật: '+data.updated+'.','success','Import Menu');
      menuImportToken='';
      await refreshAdmin({hash:'#menu'});
    }catch(err){
      if(btn){btn.disabled=false;btn.textContent='✓ Xác nhận Import';}
      adminToast(err.message,'error','Import Menu');
    }
  }
  window.commitMenuImport=commitMenuImport;

function bindAdmin(){
    bindSecurityControls();
    setupAdminSidebar();
    setupHeroBannerPreview();
    setupLocationImagePreviews();
    updateFeaturedCount();

    const auditBtn=qs('#refreshAuditLog');
    if(auditBtn && !auditBtn.dataset.bound){
      auditBtn.dataset.bound='1';
      auditBtn.addEventListener('click',loadAuditLog);
    }
    if((window.location.hash || '#overview') === '#audit') loadAuditLog();
    const root=qs('#adminRoot'); if(!root)return;
    const importForm=qs('#menuImportForm');
    if(importForm && !importForm.dataset.bound){ importForm.dataset.bound='1'; importForm.addEventListener('submit',previewMenuImport); }
    const search=qs('#dishSearch'),cat=qs('#dishCat'); if(search)search.oninput=filterDishes; if(cat)cat.onchange=filterDishes;
    qsa('#orders select, #bookings select').forEach(el=>{ if(!el.dataset.currentStatus) el.dataset.currentStatus=el.value; });

    // Drag/drop is delegated so it survives AJAX refreshes.
    const list=qs('#featuredSortList');
    if(list){
      list.ondragstart=e=>{dragItem=e.target.closest('.featured-sort-item'); if(dragItem)dragItem.classList.add('dragging');};
      list.ondragend=()=>{if(dragItem)dragItem.classList.remove('dragging');dragItem=null;};
      list.ondragover=e=>{e.preventDefault();const target=e.target.closest('.featured-sort-item');if(!dragItem||!target||target===dragItem)return;const rect=target.getBoundingClientRect();if(e.clientY<rect.top+rect.height/2)list.insertBefore(dragItem,target);else list.insertBefore(dragItem,target.nextSibling);};
    }
  }
  window.bindAdmin=bindAdmin;

  document.addEventListener('submit', e=>{
    const form=e.target.closest('form');
    if(!form || !qs('#adminRoot')) return;
    if(form.dataset.ajax==='false') return;
    if(form.action.endsWith('/admin/login') || form.action.endsWith('/admin/logout')) return;
    e.preventDefault(); submitAjaxForm(form);
  });

  document.addEventListener('change', e=>{
    const el=e.target;
    if(el.matches('#orders select, #bookings select')){
      const url=el.dataset.statusUrl;
      if(url) updateStatus(url,el.value,el);
    }
  });

  document.addEventListener('click', e=>{
    const a=e.target.closest('a[href^="#"]');
    if(a && qs('#adminRoot')){
      const id=a.getAttribute('href');
      if(id && id.length>1 && qs(id)){
        e.preventDefault();
        window.history.replaceState(null,'',id);
        showAdminSection(id,true);
        closeAdminSidebar();
      }
    }
    if(e.target.id==='dishModal')closeDish();
    if(e.target.id==='voucherModal')closeVoucher();
  });

  window.addEventListener('hashchange',()=>{
    if(!qs('#adminRoot')) return;
    showAdminSection(window.location.hash || '#overview',true);
  });

  document.addEventListener('DOMContentLoaded', bindAdmin);
})();
