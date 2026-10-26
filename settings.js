(() => {
    'use strict';
    if (!document.body?.hasAttribute('data-workspace-ui')) return;
    let state = null;
    const device = window.matchMedia('(prefers-color-scheme: dark)');
    const themeChoices = ['light', 'dark', 'system'];
    function broadcastTheme(choice) {
        document.querySelectorAll('#settingsFrame,#databaseHealthFrame,#recoveredYearsFrame').forEach(frame => {
            if (frame.contentWindow && frame.getAttribute('src')) frame.contentWindow.postMessage({type:'nisu-theme-apply',choice},location.origin);
        });
    }
    function applyTheme(choice, relay = true) {
        if (!themeChoices.includes(choice)) return;
        document.documentElement.dataset.theme = choice === 'system' ? (device.matches ? 'dark' : 'light') : choice;
        document.documentElement.dataset.themePreference = choice;
        if (window.parent === window) broadcastTheme(choice);
        else if (relay && document.body.dataset.workspaceUi === 'settings') {
            window.parent.postMessage({type:'nisu-theme-preview',choice},location.origin);
        }
    }
    device.addEventListener?.('change', () => {
        if (document.documentElement.dataset.themePreference === 'system') applyTheme('system');
    });
    window.addEventListener('message', event => {
        if (event.origin !== location.origin) return;
        const message = event.data;
        if (window.parent !== window && event.source === window.parent && message?.type === 'nisu-theme-apply') {
            applyTheme(message.choice, false);
        } else {
            const frame = document.getElementById('settingsFrame');
            if (frame && event.source === frame.contentWindow && message?.type === 'nisu-theme-preview') applyTheme(message.choice, false);
        }
    });
    function addSettingsNavigation() {
        if (document.querySelector('[data-settings-nav],#nav-settings')) return;
        const nav=document.querySelector('.workspace-sidebar nav,.settings-sidebar nav');
        const list=document.querySelector('.sidebar-nav-container ul');
        const side=document.querySelector('.side');
        const link=document.createElement('a');link.href='settings.php';link.textContent='Settings';link.dataset.settingsNav='1';
        if(nav){nav.appendChild(link);}else if(list){const li=document.createElement('li');li.className='nav-item';link.className='nav-link';li.appendChild(link);list.appendChild(li);}else if(side){link.className='side-link';side.insertBefore(link,side.querySelector('.side-bottom'));}
    }
    function applyBranding(brand) {
        const imageUrl=kind=>new URL(brand[kind+'_logo'],document.baseURI).href;
        document.querySelectorAll('img[src]').forEach(img=>{
            if(img.closest('.settings-preview,.report-paper,.recovery-print-letterhead,.portal-print-letterhead,[data-fixed-print-logos]') || img.matches('.print-logo,.report-logo'))return;
            if(!img.dataset.brandLogo){
                const name=new URL(img.getAttribute('src'),document.baseURI).pathname.split('/').pop();
                if(name==='nisu_logo.png')img.dataset.brandLogo='primary';
                if(name==='cics_logo.png')img.dataset.brandLogo='secondary';
            }
            if(['primary','secondary'].includes(img.dataset.brandLogo))img.src=imageUrl(img.dataset.brandLogo);
        });
        document.querySelectorAll('[data-brand-system],.header-text h4,.workspace-brand strong,.brand strong').forEach(el=>el.textContent=brand.system_name);
        document.querySelectorAll('[data-brand-organization],.sidebar-footer .footer-text,.workspace-college span').forEach(el=>el.textContent=brand.organization_name);
        const heading=document.querySelector('.app-topbar-brand strong');
        if(heading && brand.organization_name!=='College of Information and Computing Studies')heading.textContent=brand.organization_name;
        addSettingsNavigation();
    }
    window.applyWorkspaceBrandingToHtml = html => {
        if(!state?.branding)return html;
        const doc=new DOMParser().parseFromString(html,'text/html');
        const brand=state.branding;
        // Printed NISU and CICS seals are independent of workspace branding.
        if(brand.organization_name!=='College of Information and Computing Studies')doc.querySelectorAll('p').forEach(el=>{
            if(el.textContent.trim()==='STUDENT ORGANIZATION FUNDS')el.textContent=brand.organization_name;
        });
        return '<!doctype html>\n'+doc.documentElement.outerHTML;
    };
    window.getWorkspaceReportSignatories = (reportRole) => {
        const roles = state?.signatories?.roles || {};
        const role = reportRole || state?.role || 'admin';
        const titles = {admin:'Organization President',treasurer:'Organization Treasurer',auditor:'Organization Auditor'};
        const prepared = state?.signatories?.prepared_by_role?.[role] ||
            {name:roles.prepared?.name || '',position:titles[role] || ''};
        return {...roles, prepared};
    };
    function fillSignatories() {
        if(!state?.signatories?.roles)return;
        for(const [attr,field] of [['data-report-signatory','name'],['data-report-position','position']]){
            document.querySelectorAll('['+attr+']').forEach(input=>{
                if(!input.dataset.defaultsBound){
                    input.dataset.defaultsBound='1';
                    input.addEventListener('input',()=>{input.dataset.reportEdited='1';});
                }
                if(!input.dataset.reportEdited && (!input.value || input.value===input.dataset.defaultValue)){
                    const reportRole = input.dataset.reportPreparer || input.closest('[data-report-preparer]')?.dataset.reportPreparer;
                    input.value=window.getWorkspaceReportSignatories(reportRole)[input.getAttribute(attr)]?.[field] || '';
                    input.dataset.defaultValue=input.value;
                }
            });
        }
    }
    function accept(data) { state=data;applyTheme(data.theme);applyBranding(data.branding);fillSignatories(); }
    window.addEventListener('message', event => {
        const frame = document.getElementById('settingsFrame');
        if (event.origin !== location.origin || !frame || event.source !== frame.contentWindow || event.data?.type !== 'nisu-settings-saved') return;
        accept(event.data.data);
    });
    // Browsers allow audio only after a user gesture. Do not request device notifications.
    let audioContext=null;
    const unlockAudio=()=>{
        if(!state?.notifications?.sound)return;
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)return;
        try{audioContext=audioContext||new Audio();audioContext.resume().catch(()=>{});}catch(error){}
    };
    document.addEventListener('pointerdown',unlockAudio);
    document.addEventListener('keydown',unlockAudio);
    window.setWorkspaceNotificationPreferences=prefs=>{if(state)state.notifications=prefs;};
    window.playWorkspaceNotificationSound = () => {
        if(!audioContext || audioContext.state!=='running')return;
        try{
            const tone=audioContext.createOscillator(),volume=audioContext.createGain(),now=audioContext.currentTime;
            tone.frequency.value=740;volume.gain.setValueAtTime(0.06,now);volume.gain.exponentialRampToValueAtTime(0.001,now+0.18);
            tone.connect(volume);volume.connect(audioContext.destination);tone.start(now);tone.stop(now+0.18);
        }catch(error){}
    };
    function status(message,error=false) {
        const el=document.getElementById('workspaceSettingsStatus');
        if(el){el.textContent=message;el.className='settings-status'+(error?' error':' success');}
    }
    async function post(body) {
        const response=await fetch('settings_api.php',{method:'POST',credentials:'same-origin',headers:{'X-App-CSRF':state.csrf},body});
        const data=await response.json();if(!response.ok||data.status!=='success')throw Error(data.message||'Could not save settings.');if(window.parent!==window)window.parent.postMessage({type:'nisu-settings-saved',data},location.origin);return data;
    }
    function bindForms() {
        const appearance=document.getElementById('themeSettingsForm');
        appearance?.addEventListener('submit',async event=>{
            event.preventDefault();if(!state)return;
            const button=appearance.querySelector('button');button.disabled=true;
            const previous=state.theme;
            try {const form=new FormData(appearance);form.set('action','theme');accept(await post(form));status('Appearance saved for your account.');}
            catch(error){applyTheme(previous);status(error.message,true);}finally{button.disabled=false;}
        });
        appearance?.addEventListener('change',()=>applyTheme(new FormData(appearance).get('theme')));
        const notifications=document.getElementById('notificationSettingsForm');
        notifications?.addEventListener('submit',async event=>{
            event.preventDefault();if(!state)return;
            const button=notifications.querySelector('button');button.disabled=true;
            try{
                const form=new FormData(notifications);form.set('action','notifications');
                for(const key of ['messages','system','password_reset','sound']){
                    const input=notifications.elements[key];
                    form.set(key,input?(input.checked?'1':'0'):(state.notifications[key]?'1':'0'));
                }
                accept(await post(form));status('Notification preferences saved for your account.');
            }catch(error){status(error.message,true);}finally{button.disabled=false;}
        });
        const signatories=document.getElementById('signatorySettingsForm');
        signatories?.addEventListener('submit',async event=>{
            event.preventDefault();if(!state||!signatories.reportValidity())return;
            const button=signatories.querySelector('button');button.disabled=true;
            try{
                const form=new FormData(signatories);form.set('action','signatories');form.set('revision',state.signatories.revision);
                accept(await post(form));status('Default report signatories saved. Other users receive them when they refresh their workspace.');
            }catch(error){status(error.message,true);}finally{button.disabled=false;}
        });
        const branding=document.getElementById('brandingSettingsForm');
        if(!branding)return;
        const objectUrls={};
        function preview() {
            document.getElementById('settingsPreviewSystem').textContent=branding.elements.system_name.value || 'System name';
            document.getElementById('settingsPreviewOrganization').textContent=branding.elements.organization_name.value || 'Organization name';
            for(const kind of ['primary','secondary']){
                const target=document.getElementById(kind==='primary'?'settingsPreviewPrimary':'settingsPreviewSecondary');
                const file=branding.elements[kind+'_logo'].files[0];
                if(objectUrls[kind])URL.revokeObjectURL(objectUrls[kind]);
                if(file){objectUrls[kind]=URL.createObjectURL(file);target.src=objectUrls[kind];}
                else target.src=branding.elements['reset_'+kind].checked?(kind==='primary'?'nisu_logo.png':'cics_logo.png'):state.branding[kind+'_logo'];
            }
        }
        branding.addEventListener('input',preview);branding.addEventListener('change',preview);
        branding.addEventListener('submit',async event=>{
            event.preventDefault();if(!state||!branding.reportValidity())return;
            const button=branding.querySelector('button');button.disabled=true;
            try{
                const form=new FormData(branding);form.set('action','branding');form.set('revision',state.branding.revision);
                accept(await post(form));
                for(const kind of ['primary','secondary']){branding.elements[kind+'_logo'].value='';branding.elements['reset_'+kind].checked=false;}
                preview();status('Names and logos saved. The updated branding is shared with all roles.');
            }catch(error){status(error.message,true);}finally{button.disabled=false;}
        });
    }
    async function init() {
        try {
            if(window.workspaceSettingsBoot)accept(window.workspaceSettingsBoot);
            else {const response=await fetch('settings_api.php',{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok||data.status!=='success')throw Error(data.message||'Could not load preferences.');accept(data);}
            if (window.parent !== window) {
                try { applyTheme(window.parent.document.documentElement.dataset.themePreference || state.theme, false); } catch (error) {}
            }
            bindForms();
        }catch(error){status(error.message,true);}
    }
    new MutationObserver(records => {
        if(state && records.some(record => record.addedNodes.length))fillSignatories();
        if(state && records.some(record => [...record.addedNodes].some(node => node.nodeType===1 && (node.matches('img') || node.querySelector('img')))))applyBranding(state.branding);
    }).observe(document.body,{childList:true,subtree:true});
    init();
})();
