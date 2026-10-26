<?php
session_start();
if (empty($_SESSION['password_reset_guest_csrf'])) {
    $_SESSION['password_reset_guest_csrf'] = bin2hex(random_bytes(24));
}
if (isset($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}
$loginError = $_SESSION['login_error'] ?? null;
$previousUsername = $_SESSION['login_username'] ?? '';
unset($_SESSION['login_error'], $_SESSION['login_username']);
// Continue to support old bookmarked error links without echoing untrusted input.
if (!$loginError && isset($_GET['error'])) {
    $loginError = 'Invalid username or password. Please try again.';
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Sign in • NISU Student Fund & Audit</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <link rel="stylesheet" href="login.css?v=cics-campus-20261015">
</head>
<body>
<main class="auth-layout">
    <section class="identity-panel" aria-label="Northern Iloilo State University CICS">
        <div class="brand-bar">
            <div class="brand-emblem"><img src="nisu_logo.png" alt="Northern Iloilo State University seal"></div>
            <div class="brand-copy"><strong>NORTHERN ILOILO</strong><span>STATE UNIVERSITY</span></div>
            <span class="brand-divider" aria-hidden="true"></span>
            <div class="brand-emblem college"><img src="cics_logo.png" alt="College of Information and Computing Studies seal"></div>
        </div>

        <div class="campus-photo-card">
            <img class="campus-photo" src="cics-building-night.jpg" alt="College of Information and Computing Studies building illuminated at dusk">
            <div class="campus-photo-overlay">
                <span class="campus-photo-eyebrow">NISU CICS · ESTANCIA, ILOILO</span>
                <h1>College of Information<br>and Computing Studies</h1>
                <p>Student Organization Fund &amp; Audit System</p>
            </div>
        </div>

        <div class="identity-footer">
            <span class="identity-status"><span class="pulse-dot"></span> CICS finance &amp; audit portal</span>
            <span>INTERNAL ACCESS</span>
        </div>
    </section>
    <section class="form-panel" aria-label="Sign in">
        <div class="form-topline"><span class="mini-shield"><i class="bi bi-shield-lock"></i></span> SECURE ACCOUNT ACCESS</div>
        <div class="form-inner">
            <div class="welcome-icon"><i class="bi bi-person-check"></i></div>
            <h2>Welcome back</h2>
            <p class="intro">Enter your account credentials to continue to your dashboard.</p>
            <?php if ($loginError): ?>
                <div class="login-alert" role="alert"><i class="bi bi-exclamation-circle-fill" aria-hidden="true"></i><span><?php echo htmlspecialchars($loginError, ENT_QUOTES, 'UTF-8'); ?></span></div>
            <?php endif; ?>
            <form method="post" action="auth.php" id="loginForm">
                <div class="field">
                    <label for="usernameInput">Username</label>
                    <div class="input-wrap"><i class="bi bi-person input-icon" aria-hidden="true"></i><input id="usernameInput" type="text" name="username" autocomplete="username" maxlength="150" placeholder="Enter your username" value="<?php echo htmlspecialchars((string)$previousUsername, ENT_QUOTES, 'UTF-8'); ?>" required autofocus></div>
                </div>
                <div class="field">
                    <label for="passwordInput">Password</label>
                    <div class="input-wrap"><i class="bi bi-lock input-icon" aria-hidden="true"></i><input id="passwordInput" type="password" name="password" autocomplete="current-password" placeholder="Enter your password" required><button id="togglePasswordBtn" type="button" class="reveal-button" aria-label="Show password" aria-pressed="false"><i class="bi bi-eye" id="togglePasswordIcon"></i></button></div>
                    <div class="forgot-password-row"><button class="forgot-link" type="button" id="forgotPasswordLink">Forgot password?</button></div>
                </div>
                <button type="submit" class="submit-button" id="loginSubmitBtn"><span id="loginSubmitLabel">Sign in to dashboard</span><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
            </form>
            <div class="access-help"><i class="bi bi-info-circle"></i><span>Forgotten your password? Use the Forgot password link to request admin approval before setting a new password.</span></div>
        </div>
        <footer class="auth-footer"><?php include __DIR__ . '/system_credits.php'; ?><span>CICS · Fund &amp; Audit System</span></footer>
    </section>
</main>
<dialog id="passwordResetDialog" class="reset-dialog" aria-labelledby="resetDialogTitle">
    <div class="reset-dialog-head">
        <span class="reset-icon"><i class="bi bi-key"></i></span>
        <button type="button" id="closeResetDialog" class="reset-close" aria-label="Close"><i class="bi bi-x-lg"></i></button>
    </div>
    <h2 id="resetDialogTitle">Account recovery</h2>
    <p class="reset-subtitle">For treasurer and auditor accounts. The admin verifies your identity before authorizing a reset.</p>
    <div class="reset-tabs" role="group" aria-label="Password recovery step">
        <button type="button" class="active" id="resetRequestTab">Request approval</button>
        <button type="button" id="resetRedeemTab">I have a code</button>
    </div>
    <div id="resetFeedback" role="status" aria-live="polite" class="reset-feedback" hidden></div>
    <form id="resetRequestForm">
        <label class="reset-label" for="requestResetUsername">Your username</label>
        <input id="requestResetUsername" class="reset-input" autocomplete="username" required maxlength="50" placeholder="e.g. treasurer">
        <p class="reset-hint"><i class="bi bi-shield-check"></i> The request appears in the admin's notifications and Password Resets tab. No password changes yet.</p>
        <button class="submit-button reset-submit" type="submit">Notify administrator <i class="bi bi-arrow-right"></i></button>
    </form>
    <form id="resetRedeemForm" hidden>
        <label class="reset-label" for="redeemUsername">Your username</label>
        <input id="redeemUsername" class="reset-input" autocomplete="username" required maxlength="50" placeholder="Your existing username">
        <label class="reset-label" for="redeemCode">Admin-approved reset code</label>
        <input id="redeemCode" class="reset-input reset-code" required maxlength="70" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="NISU-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX">
        <label class="reset-label" for="redeemNewPassword">New password <span class="reset-muted">(at least 12 characters)</span></label>
        <input id="redeemNewPassword" class="reset-input" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
        <label class="reset-label" for="redeemConfirmPassword">Confirm new password</label>
        <input id="redeemConfirmPassword" class="reset-input" type="password" minlength="12" maxlength="128" autocomplete="new-password" required>
        <p class="reset-hint"><i class="bi bi-clock"></i> Your recovery code expires 30 minutes after admin approval and works only once.</p>
        <button class="submit-button reset-submit" type="submit">Set new password <i class="bi bi-check2-circle"></i></button>
    </form>
</dialog>

<script>
const passwordResetCsrf = <?php echo json_encode($_SESSION['password_reset_guest_csrf'], JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;

(function () {
    const input = document.getElementById('passwordInput');
    const toggle = document.getElementById('togglePasswordBtn');
    const toggleIcon = document.getElementById('togglePasswordIcon');
    toggle.addEventListener('click', function () {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        toggle.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
        toggle.setAttribute('aria-pressed', String(visible));
        toggleIcon.className = visible ? 'bi bi-eye-slash' : 'bi bi-eye';
    });
    document.getElementById('loginForm').addEventListener('submit', function () {
        const btn = document.getElementById('loginSubmitBtn');
        if (!this.checkValidity()) return;
        btn.disabled = true;
        document.getElementById('loginSubmitLabel').textContent = 'Signing in…';
    });
})();
(function () {
    const dialog = document.getElementById('passwordResetDialog');
    const reqForm = document.getElementById('resetRequestForm');
    const redeemForm = document.getElementById('resetRedeemForm');
    const feedback = document.getElementById('resetFeedback');
    const reqTab = document.getElementById('resetRequestTab');
    const redeemTab = document.getElementById('resetRedeemTab');
    function showStep(step) {
        const requestMode = step === 'request';
        reqForm.hidden = !requestMode;
        redeemForm.hidden = requestMode;
        reqTab.classList.toggle('active', requestMode);
        redeemTab.classList.toggle('active', !requestMode);
        feedback.hidden = true;
    }
    function message(text, error) {
        feedback.textContent = text;
        feedback.classList.toggle('is-error', !!error);
        feedback.hidden = false;
    }
    document.getElementById('forgotPasswordLink').addEventListener('click', () => {
        document.getElementById('requestResetUsername').value = document.getElementById('usernameInput').value.trim();
        document.getElementById('redeemUsername').value = document.getElementById('usernameInput').value.trim();
        showStep('request');
        dialog.showModal();
    });
    document.getElementById('closeResetDialog').addEventListener('click', () => dialog.close());
    reqTab.addEventListener('click', () => showStep('request'));
    redeemTab.addEventListener('click', () => showStep('redeem'));
    async function submitReset(form, action, payload) {
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        feedback.hidden = true;
        try {
            const response = await fetch('password_reset.php', {
                method: 'POST', credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action, csrf: passwordResetCsrf, ...payload })
            });
            const result = await response.json();
            message(result.message || 'The request could not be completed.', !response.ok || result.status !== 'success');
            if (response.ok && result.status === 'success' && action === 'redeem') {
                form.reset();
                document.getElementById('usernameInput').value = payload.username;
            }
        } catch (e) {
            message('Unable to contact the server. Check that Apache and MySQL are running.', true);
        } finally {
            button.disabled = false;
        }
    }
    reqForm.addEventListener('submit', e => {
        e.preventDefault();
        submitReset(reqForm, 'request', { username: document.getElementById('requestResetUsername').value.trim() });
    });
    redeemForm.addEventListener('submit', e => {
        e.preventDefault();
        submitReset(redeemForm, 'redeem', {
            username: document.getElementById('redeemUsername').value.trim(),
            code: document.getElementById('redeemCode').value.trim(),
            new_password: document.getElementById('redeemNewPassword').value,
            confirm_password: document.getElementById('redeemConfirmPassword').value
        });
    });
})();
</script>
</body>
</html>
