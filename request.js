// Shared request protection for dashboard APIs and account forms.
(() => {
    const token = document.querySelector('meta[name="app-csrf"]')?.content;
    if (!token) return;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        const request = input instanceof Request ? input : null;
        const url = new URL(request ? request.url : input, location.href);
        const method = String(init.method || request?.method || 'GET').toUpperCase();
        if (url.origin === location.origin && !['GET','HEAD','OPTIONS'].includes(method)) {
            const headers = new Headers(init.headers || request?.headers);
            headers.set('X-App-CSRF', token);
            init = {...init, headers};
        }
        return nativeFetch(input, init);
    };
    document.addEventListener('submit', event => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== 'post' || new URL(form.action, location.href).origin !== location.origin) return;
        let field = form.querySelector('input[name="app_csrf"]');
        if (!field) { field = document.createElement('input'); field.type = 'hidden'; field.name = 'app_csrf'; form.appendChild(field); }
        field.value = token;
    }, true);
})();
